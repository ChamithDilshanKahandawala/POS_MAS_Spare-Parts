// Milestone 11 — storage drivers (local + S3-compatible), key safety, and the
// legacy-path migration.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const {
  app, request, wipeDatabase, createUser, loginFlow, Seller, ContentBlock, mongoose,
} = require('./helpers');
const storage = require('../services/storage');
const { migrateStorage } = require('../scripts/migrateStorage');

function fakeS3() {
  const objects = new Map();
  const calls = [];
  const client = {
    async send(cmd) {
      const { Key, Body, Bucket } = cmd.input;
      calls.push({ op: cmd.constructor.name, Key, Bucket });
      if (cmd.constructor.name === 'PutObjectCommand') { objects.set(Key, Buffer.from(Body)); return {}; }
      if (cmd.constructor.name === 'GetObjectCommand') {
        if (!objects.has(Key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
        const data = objects.get(Key);
        return { Body: { transformToByteArray: async () => new Uint8Array(data) } };
      }
      if (cmd.constructor.name === 'DeleteObjectCommand') { objects.delete(Key); return {}; }
      throw new Error(`unexpected ${cmd.constructor.name}`);
    },
  };
  return { client, objects, calls };
}

let tokens = {};
const created = [];

before(async () => {
  await wipeDatabase();
  await createUser({ name: 'Staff', email: 'staff11s@test.apexora', platformRole: 'platform_staff' });
  tokens.staff = (await loginFlow('staff11s@test.apexora')).accessToken;
  process.env.S3_BUCKET = 'apexora-test-bucket';
});

afterEach(() => storage.setDriverForTests(null));

after(async () => {
  for (const f of created) fs.rmSync(f, { force: true });
  delete process.env.S3_BUCKET;
  await mongoose.disconnect();
});

test('local driver: saveFile returns a key that reads back and deletes', async () => {
  const key = await storage.saveFile(Buffer.from('hello'), 'pdf', 'seller-applications');
  assert.match(key, storage.KEY_RE);
  assert.equal((await storage.readFile(key)).toString(), 'hello');
  await storage.deleteFile(key);
  await assert.rejects(storage.readFile(key), /ENOENT/);
  await storage.deleteFile(key); // already gone: no throw
});

test('keys and paths cannot escape the uploads folder', async () => {
  await assert.rejects(storage.readFile('../../.env.development'), /Invalid storage key/);
  await assert.rejects(storage.readFile('/etc/passwd'), /outside the uploads folder/);
  await assert.rejects(storage.saveFile(Buffer.from('x'), 'jpg', '../escape'), /Invalid storage subdir/);
});

test('a record still holding an old absolute path inside uploads/ is readable', async () => {
  const legacy = path.join(storage.UPLOAD_ROOT, 'seller-media', `${crypto.randomUUID()}.jpg`);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, 'legacy-bytes');
  created.push(legacy);
  assert.equal((await storage.readFile(legacy)).toString(), 'legacy-bytes');
});

test('S3 driver: put/get/delete go to the bucket with a content type', async () => {
  const fake = fakeS3();
  storage.setDriverForTests(storage.s3Driver(fake.client));
  const key = await storage.saveFile(Buffer.from('img'), 'webp', 'listing-media');
  assert.equal(fake.calls[0].op, 'PutObjectCommand');
  assert.equal(fake.calls[0].Bucket, 'apexora-test-bucket');
  assert.equal((await storage.readFile(key)).toString(), 'img');
  await storage.deleteFile(key);
  assert.equal(fake.objects.size, 0);
  await storage.deleteFile(key); // NoSuchKey is swallowed
});

test('a banner uploaded through the API is stored in and served from the bucket', async () => {
  const fake = fakeS3();
  storage.setDriverForTests(storage.s3Driver(fake.client));
  const png = await sharp({ create: { width: 800, height: 240, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  const auth = (r) => r.set('Authorization', `Bearer ${tokens.staff}`);
  const banner = await auth(request(app).post('/api/admin/content/banners')).send({ title: { en: 'S3 banner' } });
  await auth(request(app).post(`/api/admin/content/${banner.body.block._id}/image`)).attach('file', png, 'b.png').expect(200);
  await auth(request(app).post(`/api/admin/content/${banner.body.block._id}/publish`)).send({}).expect(200);
  assert.equal(fake.objects.size, 1);
  const stored = await ContentBlock.findById(banner.body.block._id).lean();
  assert.match(stored.published.imagePath, /^content\//, 'the record holds a key, not a disk path');
  const img = await request(app).get(`/api/public/content/banners/${banner.body.block._id}/image`);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/jpeg');
  assert.ok(img.body.length > 100);
});

test('migration moves legacy files into the bucket, rewrites records, and is re-runnable', async () => {
  const legacy = path.join(storage.UPLOAD_ROOT, 'seller-media', `${crypto.randomUUID()}.jpg`);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, 'logo-bytes');
  created.push(legacy);
  const gone = path.join(storage.UPLOAD_ROOT, 'seller-media', `${crypto.randomUUID()}.jpg`);
  const seller = await Seller.create({ name: 'Mig', legalName: 'Mig Ltd', brNumber: 'BR-MIG', status: 'active', slug: 'mig-11', logo: { path: legacy }, banner: { path: gone } });

  const fake = fakeS3();
  storage.setDriverForTests(storage.s3Driver(fake.client));
  const quiet = () => {};
  const dry = await migrateStorage({ dryRun: true, log: quiet });
  assert.equal(dry.moved, 1);
  assert.equal(fake.objects.size, 0, 'dry run writes nothing');

  const result = await migrateStorage({ log: quiet });
  assert.deepEqual(result, { moved: 1, missing: 1, failed: 0 });
  const after = await Seller.findById(seller._id).lean();
  assert.equal(after.logo.path, `seller-media/${path.basename(legacy)}`);
  assert.equal(after.banner.path, gone, 'a missing file is reported and left as it was');
  assert.equal(fake.objects.get(after.logo.path).toString(), 'logo-bytes');
  assert.equal((await storage.readFile(after.logo.path)).toString(), 'logo-bytes');

  assert.equal((await migrateStorage({ log: quiet })).moved, 0, 'second run has nothing to move');
});
