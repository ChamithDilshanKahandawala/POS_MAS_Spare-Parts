// Milestone 10 — Admin → Content: drafts, publishing, windows, the public
// endpoint and its cache.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  app, request, wipeDatabase, createUser, loginFlow, AuditLog, ContentBlock, mongoose,
} = require('./helpers');

let tokens = {};
let content;
let png;

const admin = (method, path, token = tokens.staff) => request(app)[method](`/api/admin/content${path}`).set('Authorization', `Bearer ${token}`);
const pub = () => request(app).get('/api/public/content');
const load = async () => { content = (await admin('get', '')).body; };

before(async () => {
  await wipeDatabase();
  await createUser({ name: 'Staff', email: 'staff10x@test.apexora', platformRole: 'platform_staff' });
  await createUser({ name: 'Customer', email: 'cust10x@test.apexora' });
  tokens.staff = (await loginFlow('staff10x@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('cust10x@test.apexora')).accessToken;
  png = await sharp({ create: { width: 1200, height: 360, channels: 3, background: { r: 176, g: 141, b: 87 } } }).png().toBuffer();
  await load();
});

after(async () => {
  await mongoose.disconnect();
});

test('every info page and the announcement exist as empty, unpublished slots', async () => {
  assert.deepEqual(content.pages.map((p) => p.key), ['about', 'delivery', 'returns', 'terms', 'privacy']);
  assert.equal(content.announcement.published, null);
  assert.equal((await admin('get', '', tokens.customer)).status, 403);
  const p = await pub();
  assert.deepEqual(p.body, { announcement: null, banners: [], pages: {} });
});

test('a saved draft is not public until published; publishing is audited', async () => {
  const terms = content.pages.find((p) => p.key === 'terms');
  const incomplete = await admin('post', `/${terms._id}/publish`).send({});
  assert.equal(incomplete.status, 400, 'needs an English title and body');

  const saved = await admin('put', `/${terms._id}`).send({ title: { en: 'Terms of use', si: 'භාවිත නියම' }, body: { en: '## Orders\nCash on delivery only.\n\n- Item one\n- Item two' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.block.hasUnpublishedChanges, true);
  assert.deepEqual((await pub()).body.pages, {}, 'drafts never reach the storefront');

  const published = await admin('post', `/${terms._id}/publish`).send({});
  assert.equal(published.status, 200);
  assert.equal(published.body.block.hasUnpublishedChanges, false);
  const p = (await pub()).body;
  assert.equal(p.pages.terms.title.en, 'Terms of use');
  assert.equal(p.pages.terms.title.si, 'භාවිත නියම');
  assert.ok(await AuditLog.exists({ action: 'content.publish', targetId: String(terms._id) }));

  // Editing after publishing leaves the live copy alone until republished.
  await admin('put', `/${terms._id}`).send({ title: { en: 'Terms (new draft)' } });
  assert.equal((await pub()).body.pages.terms.title.en, 'Terms of use');
  await admin('post', `/${terms._id}/publish`).send({});
  assert.equal((await pub()).body.pages.terms.title.en, 'Terms (new draft)', 'publish clears the public cache');
});

test('unpublishing removes the page so the storefront falls back to built-in copy', async () => {
  const terms = content.pages.find((p) => p.key === 'terms');
  assert.equal((await admin('post', `/${terms._id}/unpublish`).send({})).status, 200);
  assert.equal((await pub()).body.pages.terms, undefined);
  assert.equal((await admin('post', `/${terms._id}/unpublish`).send({})).status, 409);
  assert.ok(await AuditLog.exists({ action: 'content.unpublish' }));
});

test('the announcement respects its start/end window', async () => {
  const id = content.announcement._id;
  const future = new Date(Date.now() + 86400e3).toISOString();
  await admin('put', `/${id}`).send({ text: { en: 'Free delivery this weekend' }, link: '/delivery', startsAt: future });
  await admin('post', `/${id}/publish`).send({});
  assert.equal((await pub()).body.announcement, null, 'not live before it starts');

  await admin('put', `/${id}`).send({ startsAt: null });
  await admin('post', `/${id}/publish`).send({});
  const live = (await pub()).body.announcement;
  assert.equal(live.text.en, 'Free delivery this weekend');
  assert.equal(live.link, '/delivery');

  const badLink = await admin('put', `/${id}`).send({ link: 'javascript:alert(1)' });
  assert.equal(badLink.status, 400);
  const backwards = await admin('put', `/${id}`).send({ startsAt: future, endsAt: new Date().toISOString() });
  assert.equal(backwards.status, 200);
  assert.equal((await admin('post', `/${id}/publish`).send({})).status, 400, 'end before start is refused at publish');
});

test('banners need an image; the public image is the published one only', async () => {
  const created = await admin('post', '/banners').send({ title: { en: 'Brake week' }, link: '/category/brakes', language: 'all' });
  assert.equal(created.status, 201);
  const id = created.body.block._id;
  assert.equal((await admin('post', `/${id}/publish`).send({})).status, 400);

  const notImage = await admin('post', `/${id}/image`).attach('file', Buffer.from('not an image'), 'x.png');
  assert.equal(notImage.status, 400);
  const up = await admin('post', `/${id}/image`).attach('file', png, 'banner.png');
  assert.equal(up.status, 200);
  assert.equal(up.body.block.draft.hasImage, true);
  assert.equal((await request(app).get(`/api/public/content/banners/${id}/image`)).status, 404, 'unpublished image is private');

  assert.equal((await admin('post', `/${id}/publish`).send({})).status, 200);
  const p = (await pub()).body;
  assert.equal(p.banners.length, 1);
  assert.equal(p.banners[0].title.en, 'Brake week');
  const img = await request(app).get(`/api/public/content/banners/${id}/image`);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/jpeg');

  const expired = await admin('post', '/banners').send({ title: { en: 'Old sale' }, endsAt: new Date(Date.now() - 1000).toISOString() });
  await admin('post', `/${expired.body.block._id}/image`).attach('file', png, 'b.png');
  await admin('post', `/${expired.body.block._id}/publish`).send({});
  assert.equal((await pub()).body.banners.length, 1, 'an ended banner is not shown');

  assert.equal((await admin('delete', `/${id}`)).status, 200);
  assert.equal((await pub()).body.banners.length, 0);
  assert.equal(await ContentBlock.countDocuments({ kind: 'banner' }), 1);
  const page = content.pages[0]._id;
  assert.equal((await admin('delete', `/${page}`)).status, 404, 'fixed slots cannot be deleted');
});
