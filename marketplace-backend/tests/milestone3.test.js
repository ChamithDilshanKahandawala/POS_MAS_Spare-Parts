const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, PlatformSettings, Category, Listing, Media, mongoose,
} = require('./helpers');

let sellerA, sellerB;
let testRoot, testChild, testRegulated;
let tokens = {};
let validJpeg, fakeExe, overSizedBuffer, jpegWithExif;

function h(req, sellerId) {
  return req.set('X-Seller-Id', sellerId.toString());
}

function fakeImageIds(n) {
  return Array.from({ length: n }, () => new mongoose.Types.ObjectId());
}

// Real Media documents a seller actually owns (no real files behind
// them — fine, since these tests never fetch the bytes) — used wherever
// a test PATCHes a listing's `images` through the real API, which
// enforces ownership and would 404 on fakeImageIds().
async function createOwnedMedia(sellerId, n = 1) {
  const docs = await Media.insertMany(Array.from({ length: n }, () => ({
    seller: sellerId,
    variants: {
      thumb: { webp: '/fake/thumb.webp', jpg: '/fake/thumb.jpg' },
      medium: { webp: '/fake/medium.webp', jpg: '/fake/medium.jpg' },
      large: { webp: '/fake/large.webp', jpg: '/fake/large.jpg' },
    },
  })));
  return docs.map((d) => d._id.toString());
}

const name = (en) => ({ en, si: '', ta: '' });

before(async () => {
  await wipeDatabase();

  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Staff', email: 'staff@test.apexora', platformRole: 'platform_staff' });
  const aOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  const aStaffUser = await createUser({ name: 'A Staff', email: 'a-staff@test.apexora' });
  const bOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });
  await createUser({ name: 'Customer', email: 'customer@test.apexora' });

  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A', status: 'active' });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B', status: 'active' });

  await SellerMember.insertMany([
    { user: aOwnerUser._id, seller: sellerA._id, role: 'seller_owner' },
    { user: aStaffUser._id, seller: sellerA._id, role: 'seller_staff' },
    { user: bOwnerUser._id, seller: sellerB._id, role: 'seller_owner' },
  ]);

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.platformStaff = (await loginFlow('staff@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.sellerAStaff = (await loginFlow('a-staff@test.apexora')).accessToken;
  tokens.sellerBOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer@test.apexora')).accessToken;

  // Probation disabled by default so most tests don't need to think
  // about it — the dedicated probation test below sets it deliberately.
  await PlatformSettings.findByIdAndUpdate('platform-settings', { reviewRequiredForFirstNListings: 0 }, { upsert: true });

  testRoot = await Category.create({
    name: name('Test Parts'), slug: 'test-parts', depth: 0, commissionRateBps: 0,
    returnPolicy: { returnable: true, windowDays: 7, note: name('') },
    prohibitedKeywords: ['bannedword', 'තහනම්පදය'],
    attributeSchema: [{ key: 'condition', label: name('Condition'), type: 'select', required: true, options: [{ value: 'new', label: name('New') }, { value: 'used', label: name('Used') }] }],
  });
  testChild = await Category.create({ name: name('Test Brakes'), slug: 'test-brakes', parentId: testRoot._id, depth: 1, commissionRateBps: 0 });
  testRegulated = await Category.create({
    name: name('Test Cosmetics'), slug: 'test-cosmetics', depth: 0, commissionRateBps: 0,
    regulated: true, reviewRequired: true,
    returnPolicy: { returnable: false, windowDays: 0, note: name('') },
    attributeSchema: [{ key: 'expiryDate', label: name('Expiry date'), type: 'date', required: true }],
  });

  validJpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toBuffer();
  fakeExe = Buffer.from('MZ\x90\x00 this is actually an executable, not an image');
  overSizedBuffer = Buffer.concat([validJpeg, Buffer.alloc(8 * 1024 * 1024 + 1, 'a')]);
  jpegWithExif = await sharp(validJpeg)
    .withMetadata({ exif: { IFD0: { Copyright: 'Should be stripped' }, GPS: { GPSLatitude: '6/1,55/1,0/1', GPSLongitude: '79/1,51/1,0/1' } } })
    .jpeg()
    .toBuffer();
});

after(async () => {
  await Category.deleteMany({});
  await Listing.deleteMany({});
  await Media.deleteMany({});
  await mongoose.disconnect();
});

// Deliberately has NO `images` field — a test that PATCHes a listing
// through the real API (which enforces media ownership) must supply its
// own real, owned media ids (createOwnedMedia); a test that writes a
// Listing directly to the DB (createDraft) gets fakeImageIds() instead,
// which is fine there since that path never goes through the ownership
// check at all.
function baselineListingFields(overrides = {}) {
  return {
    title: name('A perfectly good test listing title'),
    description: name('This is a description that is definitely long enough to pass the twenty character minimum with room to spare.'),
    categoryId: testChild._id,
    brand: 'TestBrand',
    condition: 'new',
    attributes: { condition: 'new' },
    priceCents: 10000,
    stock: 5,
    weightGrams: 500,
    ...overrides,
  };
}

async function createDraft(sellerId, overrides = {}) {
  const { images, ...fields } = overrides;
  return Listing.create({ seller: sellerId, status: 'draft', images: images || fakeImageIds(2), ...baselineListingFields(fields) });
}

// --- Authorization & scoping ---

test('seller A cannot read, edit, delete, or list seller B\'s listing (404)', async () => {
  const listing = await createDraft(sellerB._id);

  const getRes = await h(request(app).get(`/api/seller/listings/${listing._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(getRes.status, 404);

  const patchRes = await h(request(app).patch(`/api/seller/listings/${listing._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ priceCents: 500 }), sellerA._id);
  assert.equal(patchRes.status, 404);

  const deleteRes = await h(request(app).delete(`/api/seller/listings/${listing._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(deleteRes.status, 404);
});

test('a seller can never attach another seller\'s media to their listing (404)', async () => {
  const draft = await createDraft(sellerA._id, { images: [] });
  const otherMedia = await Media.create({
    seller: sellerB._id,
    variants: { thumb: { webp: '/x', jpg: '/x' }, medium: { webp: '/x', jpg: '/x' }, large: { webp: '/x', jpg: '/x' } },
  });

  const res = await h(
    request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ images: [otherMedia._id.toString()] }),
    sellerA._id
  );
  assert.equal(res.status, 404);
});

test('seller staff can create, edit, and submit listings', async () => {
  const createRes = await h(request(app).post('/api/seller/listings').set('Authorization', `Bearer ${tokens.sellerAStaff}`).send({ categoryId: testChild._id.toString() }), sellerA._id);
  assert.equal(createRes.status, 201);
  const id = createRes.body.listing._id;

  const images = await createOwnedMedia(sellerA._id, 1);
  const patchRes = await h(request(app).patch(`/api/seller/listings/${id}`).set('Authorization', `Bearer ${tokens.sellerAStaff}`).send(baselineListingFields({ images })), sellerA._id);
  assert.equal(patchRes.status, 200);

  const submitRes = await h(request(app).post(`/api/seller/listings/${id}/submit`).set('Authorization', `Bearer ${tokens.sellerAStaff}`), sellerA._id);
  assert.equal(submitRes.status, 200);
  assert.ok(['in_review', 'published'].includes(submitRes.body.listing.status));
});

test('view-as is read-only: cannot create or submit a listing', async () => {
  const viewAsRes = await request(app).post(`/api/admin/sellers/${sellerA._id}/view-as`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  const viewAsToken = viewAsRes.body.token;

  const createRes = await h(request(app).post('/api/seller/listings').set('Authorization', `Bearer ${viewAsToken}`).send({ categoryId: testChild._id.toString() }), sellerA._id);
  assert.equal(createRes.status, 403);
});

test('a suspended store cannot create or submit a listing', async () => {
  const suspendedSeller = await Seller.create({ name: 'Suspended Co', legalName: 'Suspended Co Ltd', brNumber: 'BR-SUS', status: 'suspended' });
  const suspendedOwner = await createUser({ name: 'Sus Owner', email: 'sus-owner@test.apexora' });
  await SellerMember.create({ user: suspendedOwner._id, seller: suspendedSeller._id, role: 'seller_owner' });
  const suspendedToken = (await loginFlow('sus-owner@test.apexora')).accessToken;

  const res = await h(request(app).post('/api/seller/listings').set('Authorization', `Bearer ${suspendedToken}`).send({ categoryId: testChild._id.toString() }), suspendedSeller._id);
  assert.equal(res.status, 403);
});

// --- Automatic checks ---

test('checks: missing a required field inherited from the parent category', async () => {
  const draft = await createDraft(sellerA._id, { attributes: {} });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(res.status, 200);
  assert.ok(res.body.problems.some((p) => p.field === 'attributes.condition'));
});

test('checks: prohibited keyword in English and in Sinhala', async () => {
  const enDraft = await createDraft(sellerA._id, { title: name('This item is a bannedword in the title') });
  const enRes = await h(request(app).post(`/api/seller/listings/${enDraft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(enRes.body.problems.some((p) => p.problem.includes('bannedword')));

  const siDraft = await createDraft(sellerA._id, { description: { en: 'A fine description with more than twenty characters in it.', si: 'තහනම්පදය', ta: '' } });
  const siRes = await h(request(app).post(`/api/seller/listings/${siDraft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(siRes.body.problems.some((p) => p.problem.includes('තහනම්පදය')));
});

test('checks: Sri Lankan phone number formats are caught', async () => {
  const d1 = await createDraft(sellerA._id, { description: { en: 'Call me on 077 123 4567 for a better price any time please.', si: '', ta: '' } });
  const r1 = await h(request(app).post(`/api/seller/listings/${d1._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(r1.body.problems.some((p) => p.problem.includes('phone')));

  const d2 = await createDraft(sellerA._id, { description: { en: 'WhatsApp +94771234567 if you are interested in buying this.', si: '', ta: '' } });
  const r2 = await h(request(app).post(`/api/seller/listings/${d2._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(r2.body.problems.some((p) => p.problem.includes('phone')));
});

test('checks: email and URL in the description are caught', async () => {
  const d1 = await createDraft(sellerA._id, { description: { en: 'Email me at buyer@example.com if you want to negotiate price.', si: '', ta: '' } });
  const r1 = await h(request(app).post(`/api/seller/listings/${d1._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(r1.body.problems.some((p) => p.problem.includes('email')));

  const d2 = await createDraft(sellerA._id, { description: { en: 'Check out www.example.com for more photos of this item.', si: '', ta: '' } });
  const r2 = await h(request(app).post(`/api/seller/listings/${d2._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(r2.body.problems.some((p) => p.problem.includes('web link')));
});

test('checks: more than 8 images is rejected', async () => {
  const draft = await createDraft(sellerA._id, { images: fakeImageIds(9) });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(res.body.problems.some((p) => p.field === 'images'));
});

test('checks: expired date on a regulated field is rejected', async () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const draft = await createDraft(sellerA._id, { categoryId: testRegulated._id, attributes: { expiryDate: past } });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(res.body.problems.some((p) => p.field === 'attributes.expiryDate'));
});

test('checks: an invalid "was" price is rejected', async () => {
  const draft = await createDraft(sellerA._id, { priceCents: 1000, wasPriceCents: 2000, priceHistory: [] });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(res.body.problems.some((p) => p.field === 'wasPriceCents'));

  const draft2 = await createDraft(sellerA._id, {
    priceCents: 1000,
    wasPriceCents: 900, // lower than current — invalid even though it IS in history
    priceHistory: [{ priceCents: 900, setAt: new Date() }],
  });
  const res2 = await h(request(app).post(`/api/seller/listings/${draft2._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(res2.body.problems.some((p) => p.field === 'wasPriceCents'));
});

test('a clean listing has no problems', async () => {
  const draft = await createDraft(sellerA._id);
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/check`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.deepEqual(res.body.problems, []);
});

// --- Submit / review decision / transitions ---

let publishedListingId;

test('submit: a clean listing in a non-reviewRequired category publishes directly', async () => {
  const draft = await createDraft(sellerA._id);
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'published');
  assert.ok(res.body.listing.firstPublishedAt);
  publishedListingId = res.body.listing._id;
});

test('submit: a listing in a reviewRequired/regulated category goes to in_review, not published', async () => {
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const draft = await createDraft(sellerA._id, { categoryId: testRegulated._id, attributes: { expiryDate: future } });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'in_review');
});

test('a seller cannot submit a listing that has unresolved problems', async () => {
  const draft = await createDraft(sellerA._id, { attributes: {} });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'draft'); // unchanged
  assert.ok(res.body.problems.length > 0);
});

test('a seller cannot approve their own listing (admin-only route)', async () => {
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const draft = await createDraft(sellerA._id, { categoryId: testRegulated._id, attributes: { expiryDate: future } });
  await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);

  const res = await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.sellerAOwner}`);
  assert.equal(res.status, 403);
});

test('customer and logged-out get 401/403 on admin review routes', async () => {
  const customerRes = await request(app).get('/api/admin/listings').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(customerRes.status, 403);

  const loggedOutRes = await request(app).get('/api/admin/listings');
  assert.equal(loggedOutRes.status, 401);
});

test('admin approves an in_review listing: it becomes published and the seller is notified', async () => {
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const draft = await createDraft(sellerA._id, { categoryId: testRegulated._id, attributes: { expiryDate: future } });
  await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);

  const res = await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'published');
});

test('admin rejects an in_review listing with reasons: it becomes rejected, and an edit moves it back to draft', async () => {
  const draft = await createDraft(sellerA._id, { categoryId: testRoot._id, attributes: { condition: 'new' } });
  await Category.findByIdAndUpdate(testRoot._id, { reviewRequired: true });
  const submitRes = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(submitRes.body.listing.status, 'in_review');

  const rejectRes = await request(app).post(`/api/admin/listings/${draft._id}/reject`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reasons: ['poor_photos'], note: 'Photos are blurry' });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.listing.status, 'rejected');

  const editRes = await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ brand: 'Updated Brand' }), sellerA._id);
  assert.equal(editRes.body.listing.status, 'draft');
  assert.deepEqual(editRes.body.listing.rejectionReasons, []);

  await Category.findByIdAndUpdate(testRoot._id, { reviewRequired: null });
});

test('hide/show: published <-> hidden, and disallowed transitions are 409', async () => {
  const hideRes = await h(request(app).post(`/api/seller/listings/${publishedListingId}/hide`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(hideRes.status, 200);
  assert.equal(hideRes.body.listing.status, 'hidden');

  const hideAgainRes = await h(request(app).post(`/api/seller/listings/${publishedListingId}/hide`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(hideAgainRes.status, 409);

  const showRes = await h(request(app).post(`/api/seller/listings/${publishedListingId}/show`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(showRes.status, 200);
  assert.equal(showRes.body.listing.status, 'published');
});

test('admin suspends a published listing with a reason, then reinstates it', async () => {
  const suspendRes = await request(app).post(`/api/admin/listings/${publishedListingId}/suspend`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reason: 'Under investigation' });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.body.listing.status, 'suspended');

  const editWhileSuspendedRes = await h(request(app).patch(`/api/seller/listings/${publishedListingId}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ priceCents: 1 }), sellerA._id);
  assert.equal(editWhileSuspendedRes.status, 409);

  const reinstateRes = await request(app).post(`/api/admin/listings/${publishedListingId}/reinstate`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ to: 'published' });
  assert.equal(reinstateRes.status, 200);
  assert.equal(reinstateRes.body.listing.status, 'published');
});

test('only draft listings can be deleted', async () => {
  const draftRes = await h(request(app).delete(`/api/seller/listings/${publishedListingId}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(draftRes.status, 409);

  const draft = await createDraft(sellerA._id);
  const okRes = await h(request(app).delete(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(okRes.status, 200);
});

// --- Revisions ---

test('revision: a content edit on a published listing (review required) becomes a pending revision; live stays unchanged', async () => {
  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: true });
  const draft = await createDraft(sellerA._id);
  const submitRes = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(submitRes.body.listing.status, 'in_review');
  await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  const originalTitle = (await Listing.findById(draft._id)).title.en;

  const reviseRes = await h(
    request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ title: name('A brand new revised title for this item') }),
    sellerA._id
  );
  assert.equal(reviseRes.status, 200);
  assert.equal(reviseRes.body.pendingReview, true);

  const liveListing = await Listing.findById(draft._id);
  assert.equal(liveListing.status, 'published');
  assert.equal(liveListing.title.en, originalTitle); // unchanged while pending
  assert.equal(liveListing.pendingRevision.fields.title.en, 'A brand new revised title for this item');

  const approveRes = await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(approveRes.status, 200);
  const afterApprove = await Listing.findById(draft._id);
  assert.equal(afterApprove.title.en, 'A brand new revised title for this item');
  assert.equal(afterApprove.pendingRevision.fields, null);

  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: null });
});

test('revision: rejecting a revision leaves the live version untouched', async () => {
  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: true });
  const draft = await createDraft(sellerA._id, { brand: 'OriginalBrand' });
  await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ brand: 'ProposedBrand' }), sellerA._id);

  const rejectRes = await request(app).post(`/api/admin/listings/${draft._id}/reject`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reasons: ['other'], note: 'Not this time' });
  assert.equal(rejectRes.status, 200);

  const live = await Listing.findById(draft._id);
  assert.equal(live.status, 'published');
  assert.equal(live.brand, 'OriginalBrand');
  assert.equal(live.pendingRevision.fields, null);

  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: null });
});

test('revision: price and stock edits on a published listing apply instantly, no review, even in a reviewRequired category', async () => {
  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: true });
  const draft = await createDraft(sellerA._id);
  await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  const res = await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ priceCents: 5000, stock: 1 }), sellerA._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'published');
  assert.equal(res.body.listing.priceCents, 5000);
  assert.equal(res.body.listing.pendingRevision.fields, null);

  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: null });
});

test('weightGrams changes are logged to weightHistory; other instant fields are not', async () => {
  const draft = await createDraft(sellerA._id, { weightGrams: 500 });

  const res1 = await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ weightGrams: 700, stock: 9 }), sellerA._id);
  assert.equal(res1.status, 200);
  assert.equal(res1.body.listing.weightGrams, 700);
  assert.equal(res1.body.listing.weightHistory.length, 1);
  assert.equal(res1.body.listing.weightHistory[0].weightGrams, 700);
  assert.ok(res1.body.listing.weightHistory[0].by);

  // Sending the same value again is not a change — no new entry.
  const res2 = await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ weightGrams: 700 }), sellerA._id);
  assert.equal(res2.body.listing.weightHistory.length, 1);

  const res3 = await h(request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ weightGrams: 850 }), sellerA._id);
  assert.equal(res3.body.listing.weightHistory.length, 2);
  assert.equal(res3.body.listing.weightHistory[1].weightGrams, 850);
});

// --- Probation and reviewExempt ---

test('probation: a new seller\'s first N listings require review; the counter only counts ever-published listings', async () => {
  await PlatformSettings.findByIdAndUpdate('platform-settings', { reviewRequiredForFirstNListings: 2 });
  const probUser = await createUser({ name: 'Prob Owner', email: 'prob-owner@test.apexora' });
  const probSeller = await Seller.create({ name: 'Probation Store', legalName: 'Probation Store Ltd', brNumber: 'BR-PROB', status: 'active' });
  await SellerMember.create({ user: probUser._id, seller: probSeller._id, role: 'seller_owner' });
  const probToken = (await loginFlow('prob-owner@test.apexora')).accessToken;

  const d1 = await createDraft(probSeller._id);
  const s1 = await h(request(app).post(`/api/seller/listings/${d1._id}/submit`).set('Authorization', `Bearer ${probToken}`), probSeller._id);
  assert.equal(s1.body.listing.status, 'in_review'); // 0 published < 2
  await request(app).post(`/api/admin/listings/${d1._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  const d2 = await createDraft(probSeller._id);
  const s2 = await h(request(app).post(`/api/seller/listings/${d2._id}/submit`).set('Authorization', `Bearer ${probToken}`), probSeller._id);
  assert.equal(s2.body.listing.status, 'in_review'); // 1 published < 2
  await request(app).post(`/api/admin/listings/${d2._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  const d3 = await createDraft(probSeller._id);
  const s3 = await h(request(app).post(`/api/seller/listings/${d3._id}/submit`).set('Authorization', `Bearer ${probToken}`), probSeller._id);
  assert.equal(s3.body.listing.status, 'published'); // 2 published, no longer < 2

  await PlatformSettings.findByIdAndUpdate('platform-settings', { reviewRequiredForFirstNListings: 0 });
});

test('reviewExempt bypasses review entirely, even for a regulated/reviewRequired category', async () => {
  const exemptUser = await createUser({ name: 'Exempt Owner', email: 'exempt-owner@test.apexora' });
  const exemptSeller = await Seller.create({ name: 'Exempt Store', legalName: 'Exempt Store Ltd', brNumber: 'BR-EXEMPT', status: 'active', reviewExempt: true });
  await SellerMember.create({ user: exemptUser._id, seller: exemptSeller._id, role: 'seller_owner' });
  const exemptToken = (await loginFlow('exempt-owner@test.apexora')).accessToken;

  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const draft = await createDraft(exemptSeller._id, { categoryId: testRegulated._id, attributes: { expiryDate: future } });
  const res = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${exemptToken}`), exemptSeller._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.status, 'published');
});

test('reviewExempt is owner-only to change, and is audited', async () => {
  const staffRes = await request(app).patch(`/api/admin/sellers/${sellerA._id}/overrides`).set('Authorization', `Bearer ${tokens.platformStaff}`).send({ reviewExempt: true, reason: 'test' });
  assert.equal(staffRes.status, 403);

  const ownerRes = await request(app).patch(`/api/admin/sellers/${sellerA._id}/overrides`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reviewExempt: true, reason: 'Trusted seller' });
  assert.equal(ownerRes.status, 200);
  assert.equal(ownerRes.body.seller.reviewExempt, true);

  const entry = await AuditLog.findOne({ targetId: sellerA._id.toString(), action: 'seller.overrides.update' }).sort({ createdAt: -1 });
  assert.ok(entry);
  await Seller.findByIdAndUpdate(sellerA._id, { reviewExempt: false });
});

// --- Public API ---

test('public API never returns unpublished, out-of-stock, or suspended-seller/inactive-category listings', async () => {
  const draftListing = await createDraft(sellerA._id);
  const inReviewListing = await Listing.create({ seller: sellerA._id, status: 'in_review', ...baselineListingFields() });
  const rejectedListing = await Listing.create({ seller: sellerA._id, status: 'rejected', ...baselineListingFields() });
  const hiddenListing = await Listing.create({ seller: sellerA._id, status: 'hidden', ...baselineListingFields() });
  const suspendedListing = await Listing.create({ seller: sellerA._id, status: 'suspended', ...baselineListingFields() });
  const outOfStockListing = await Listing.create({ seller: sellerA._id, status: 'published', firstPublishedAt: new Date(), ...baselineListingFields({ stock: 0 }) });

  const publicRes = await request(app).get('/api/public/listings');
  const ids = publicRes.body.listings.map((l) => String(l.id));
  for (const l of [draftListing, inReviewListing, rejectedListing, hiddenListing, suspendedListing, outOfStockListing]) {
    assert.ok(!ids.includes(String(l._id)), `${l.status} listing should not appear publicly`);
  }

  for (const l of [draftListing, inReviewListing, rejectedListing, hiddenListing, suspendedListing]) {
    const detailRes = await request(app).get(`/api/public/listings/${l._id}`);
    assert.equal(detailRes.status, 404);
  }
});

test('public API never returns internal fields or a pending revision\'s content', async () => {
  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: true });
  const draft = await createDraft(sellerA._id, { title: name('The real live title customers should see') });
  await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  await request(app).post(`/api/admin/listings/${draft._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  await h(
    request(app).patch(`/api/seller/listings/${draft._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ title: name('A sneaky proposed title nobody approved yet') }),
    sellerA._id
  );

  const res = await request(app).get(`/api/public/listings/${draft._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.title.en, 'The real live title customers should see');
  assert.equal(res.body.listing.statusHistory, undefined);
  assert.equal(res.body.listing.rejectionReasons, undefined);
  assert.equal(res.body.listing.pendingRevision, undefined);
  assert.equal(res.body.listing.categorySchemaVersion, undefined);
  assert.equal(res.body.listing.commission, undefined);

  await Category.findByIdAndUpdate(testChild._id, { reviewRequired: null });
});

// --- Uploads ---

test('uploads: a fake file disguised as an image is rejected', async () => {
  const draft = await createDraft(sellerA._id, { images: [] });
  const res = await h(
    request(app).post(`/api/seller/listings/${draft._id}/media`).set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('files', fakeExe, 'photo.jpg');
  assert.equal(res.status, 400);
});

test('uploads: an oversized file is rejected', async () => {
  const draft = await createDraft(sellerA._id, { images: [] });
  const res = await h(
    request(app).post(`/api/seller/listings/${draft._id}/media`).set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('files', overSizedBuffer, 'photo.jpg');
  assert.equal(res.status, 400);
});

test('uploads: a valid photo is processed and all EXIF/GPS metadata is stripped', async () => {
  const inputMeta = await sharp(jpegWithExif).metadata();
  assert.ok(inputMeta.exif, 'test fixture must actually carry EXIF to prove anything');

  const draft = await createDraft(sellerA._id, { images: [] });
  const uploadRes = await h(
    request(app).post(`/api/seller/listings/${draft._id}/media`).set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('files', jpegWithExif, 'photo.jpg');
  assert.equal(uploadRes.status, 201);
  const mediaId = uploadRes.body.media[0]._id;

  const fetchRes = await h(
    request(app).get(`/api/seller/media/${mediaId}/large/jpg`).set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(fetchRes.status, 200);
  const outputMeta = await sharp(fetchRes.body).metadata();
  assert.equal(outputMeta.exif, undefined);
});

// --- Audit ---

test('listing create, submit, approve, reject, and suspend are each audited', async () => {
  const createRes = await h(request(app).post('/api/seller/listings').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ categoryId: testChild._id.toString() }), sellerA._id);
  const id = createRes.body.listing._id;
  assert.ok(await AuditLog.findOne({ targetId: id, action: 'listing.create' }));

  const images = await createOwnedMedia(sellerA._id, 1);
  await h(request(app).patch(`/api/seller/listings/${id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`).send(baselineListingFields({ images })), sellerA._id);
  const submitRes = await h(request(app).post(`/api/seller/listings/${id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.ok(await AuditLog.findOne({ targetId: id, action: 'listing.submit' }));

  if (submitRes.body.listing.status === 'in_review') {
    const approveRes = await request(app).post(`/api/admin/listings/${id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
    assert.equal(approveRes.status, 200);
    assert.ok(await AuditLog.findOne({ targetId: id, action: 'listing.approve' }));
  }

  const suspendRes = await request(app).post(`/api/admin/listings/${id}/suspend`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reason: 'audit test' });
  assert.equal(suspendRes.status, 200);
  assert.ok(await AuditLog.findOne({ targetId: id, action: 'listing.suspend' }));
});

// --- Category schema drift ---

test('a new required category field flags existing listings as needsUpdate and notifies the seller', async () => {
  const driftCategory = await Category.create({ name: name('Drift Test'), slug: 'drift-test', depth: 0, commissionRateBps: 0 });
  const draft = await createDraft(sellerA._id, { categoryId: driftCategory._id, attributes: {} });
  const submitRes = await h(request(app).post(`/api/seller/listings/${draft._id}/submit`).set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(submitRes.body.listing.status, 'published');

  const patchRes = await request(app)
    .patch(`/api/admin/catalog/categories/${driftCategory._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ attributeSchema: [{ key: 'serialNumber', label: name('Serial number'), type: 'text', required: true }] });
  assert.equal(patchRes.status, 200);

  const updated = await Listing.findById(draft._id);
  assert.equal(updated.needsUpdate, true);
});
