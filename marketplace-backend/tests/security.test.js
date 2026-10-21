// Hardening pass 1 — security regression tests. Each section corresponds
// to one numbered item in that pass; new sections get added here as the
// rest of the pass lands, rather than scattering one-off security tests
// across the milestone files.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow, TEST_PASSWORD,
  Seller, SellerMember, AuditLog, User, Category, mongoose,
} = require('./helpers');
const { maskAuditSnapshot, SENSITIVE_KEY_PATTERN } = require('../utils/maskAuditSnapshot');

let sellerA;
let tokens = {};

before(async () => {
  await wipeDatabase();
  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  const ownerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A', status: 'active' });
  await SellerMember.create({ user: ownerUser._id, seller: sellerA._id, role: 'seller_owner' });
  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
});

after(async () => {
  await mongoose.disconnect();
});

function seller(req, id) {
  return req.set('X-Seller-Id', id.toString());
}

// Recursively finds any value under a sensitive-named key that ISN'T
// already masked (doesn't start with '***' or equal '[REDACTED]') —
// the same shape of check a real log-scrub audit would run.
function findUnmaskedSensitiveValues(obj, path = '') {
  const hits = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return hits;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...findUnmaskedSensitiveValues(v, `${path}[${i}]`)));
    return hits;
  }
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      const masked = typeof value === 'string' && (value.startsWith('***') || value === '[REDACTED]');
      if (!masked) hits.push({ path: fullPath, value });
    } else if (value && typeof value === 'object') {
      hits.push(...findUnmaskedSensitiveValues(value, fullPath));
    }
  }
  return hits;
}

// --- 1. Audit log masking ---

test('maskAuditSnapshot redacts sensitive fields at any depth, leaves everything else untouched', () => {
  const input = {
    name: 'Store A',
    bankAccount: { bankName: 'Sampath', accountNumber: '123456789012' },
    nic: '991234567V',
    password: 'hunter2',
    otpCodeHash: '$2a$10$abc',
    stepUpOtpHash: '$2a$10$def',
    refreshTokenHash: '$2a$10$ghi',
    nested: { tokenHash: 'xyz', ok: true },
  };
  const masked = maskAuditSnapshot(input);

  assert.equal(masked.name, 'Store A');
  assert.equal(masked.bankAccount.bankName, 'Sampath');
  assert.equal(masked.bankAccount.accountNumber, '***9012');
  assert.equal(masked.nic, '***567V');
  assert.equal(masked.password, '[REDACTED]');
  assert.equal(masked.otpCodeHash, '[REDACTED]');
  assert.equal(masked.stepUpOtpHash, '[REDACTED]');
  assert.equal(masked.refreshTokenHash, '[REDACTED]');
  assert.equal(masked.nested.tokenHash, '[REDACTED]');
  assert.equal(masked.nested.ok, true);

  // Original object is untouched — logAction must never mutate what the
  // caller still holds a reference to (e.g. to build a response after).
  assert.equal(input.bankAccount.accountNumber, '123456789012');
});

test('logAction masks a sensitive field even if a future caller passes a raw document through', async () => {
  const { logAction } = require('../services/auditLog');
  const owner = await User.findOne({ email: 'owner@test.apexora' });

  await logAction({
    actor: owner,
    actorRole: 'platform_owner',
    action: 'test.raw_document_snapshot',
    targetType: 'Seller',
    targetId: sellerA._id,
    before: { accountNumber: '999988887777', nic: '881234567V' },
    after: { accountNumber: '111122223333' },
    summary: 'Simulated a careless call site passing raw sensitive fields',
  });

  const entry = await AuditLog.findOne({ action: 'test.raw_document_snapshot' }).lean();
  assert.equal(entry.before.accountNumber, '***7777');
  assert.equal(entry.before.nic, '***567V');
  assert.equal(entry.after.accountNumber, '***3333');
});

test('the real bank step-up + update flow never writes an unmasked sensitive field to the audit log', async () => {
  const startRes = await seller(
    request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ password: TEST_PASSWORD }),
    sellerA._id,
  );
  await seller(
    request(app).post('/api/seller/bank/step-up/verify').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ code: startRes.body.debugOtpCode }),
    sellerA._id,
  );
  await seller(
    request(app).patch('/api/seller/bank').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({
      bankName: 'Sampath Bank', branch: 'Colombo', accountName: 'Store A', accountNumber: '555566667777',
    }),
    sellerA._id,
  );
  await request(app).get(`/api/admin/sellers/${sellerA._id}/bank`).set('Authorization', `Bearer ${tokens.platformOwner}`);

  const entries = await AuditLog.find({ targetId: sellerA._id.toString() }).lean();
  assert.ok(entries.length > 0, 'sanity check — the flow above must have produced at least one audit entry');

  const allHits = entries.flatMap((e) => [
    ...findUnmaskedSensitiveValues(e.before, `${e.action}.before`),
    ...findUnmaskedSensitiveValues(e.after, `${e.action}.after`),
  ]);
  assert.deepEqual(allHits, [], `found unmasked sensitive field(s) in the audit log: ${JSON.stringify(allHits)}`);
});

// --- 2. Rate limiting ---
//
// writeLimiter/uploadLimiter are deliberately relaxed under
// NODE_ENV=test (same reasoning as the existing authLimiter) so the rest
// of the suite isn't tripped by its own request volume — so actual
// 429-blocking is exercised here against a throwaway low-max instance of
// the real `express-rate-limit` usage, not the relaxed app-wide one.

test('keyByUserOrIp keys by user when a valid token is present, falls back to IP otherwise', () => {
  const { keyByUserOrIp } = require('../middleware/rateLimiter');
  const { signAccessToken } = require('../services/tokens');

  const token = signAccessToken({ _id: '507f1f77bcf86cd799439011' });
  const authed = keyByUserOrIp({ headers: { authorization: `Bearer ${token}` }, ip: '1.2.3.4' });
  assert.equal(authed, 'user:507f1f77bcf86cd799439011');

  const noToken = keyByUserOrIp({ headers: {}, ip: '1.2.3.4' });
  assert.equal(noToken, 'ip:1.2.3.4');

  const badToken = keyByUserOrIp({ headers: { authorization: 'Bearer not-a-real-token' }, ip: '5.6.7.8' });
  assert.equal(badToken, 'ip:5.6.7.8');
});

test('the autosave route gets its own higher limit (600/15min) than general writes (120/15min)', async () => {
  const { AUTOSAVE_LIMIT_MAX, WRITE_LIMIT_MAX } = require('../middleware/rateLimiter');
  assert.equal(AUTOSAVE_LIMIT_MAX, 600);
  assert.equal(WRITE_LIMIT_MAX, 120);
  assert.ok(AUTOSAVE_LIMIT_MAX > WRITE_LIMIT_MAX, 'autosave must be allowed strictly more requests than a general write');
});

test('autosave limiter: 200 saves within the window succeed, and the 601st (past the real 600 max) returns 429', async () => {
  const express = require('express');
  const rateLimit = require('express-rate-limit');
  const { AUTOSAVE_LIMIT_MAX } = require('../middleware/rateLimiter');

  // A throwaway app using the REAL configured max (600) directly, rather
  // than the real autosaveLimiter instance — that one is deliberately
  // relaxed under NODE_ENV=test (same reasoning as every other limiter
  // in this file) so the rest of the suite's own request volume doesn't
  // trip it, which would defeat testing the actual threshold here.
  const testApp = express();
  testApp.use(rateLimit({ windowMs: 15 * 60 * 1000, max: AUTOSAVE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }));
  testApp.patch('/listings/:id', (req, res) => res.json({ ok: true }));

  for (let i = 1; i <= 200; i++) {
    const res = await request(testApp).patch('/listings/000000000000000000000001');
    assert.equal(res.status, 200, `save #${i} (well under the 600 max) must succeed`);
  }
  for (let i = 201; i <= AUTOSAVE_LIMIT_MAX; i++) {
    const res = await request(testApp).patch('/listings/000000000000000000000001');
    assert.equal(res.status, 200, `save #${i} (still within the 600 max) must succeed`);
  }
  const res601 = await request(testApp).patch('/listings/000000000000000000000001');
  assert.equal(res601.status, 429, 'the 601st save, past the 600 max, must be rate-limited');
  assert.ok(res601.headers['retry-after'], 'a 429 must carry Retry-After so the client knows how long to actually wait');
});

test('a write-route limiter built the same way as writeLimiter actually blocks after its max', async () => {
  const express = require('express');
  const rateLimit = require('express-rate-limit');

  const testApp = express();
  const lowLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  });
  testApp.use(lowLimiter);
  testApp.post('/write', (req, res) => res.json({ ok: true }));
  testApp.get('/read', (req, res) => res.json({ ok: true }));

  const results = [];
  for (let i = 0; i < 5; i++) results.push((await request(testApp).post('/write')).status);
  assert.deepEqual(results, [200, 200, 200, 429, 429], 'the 4th and 5th write in the window must be blocked');

  // Reads are never throttled by this shape of limiter.
  for (let i = 0; i < 5; i++) {
    const res = await request(testApp).get('/read');
    assert.equal(res.status, 200);
  }
});

// --- 3. Request body size limit ---

test('a JSON body over 200kb is rejected with 413 (before auth even runs)', async () => {
  const oversized = { padding: 'x'.repeat(250 * 1024) };
  // Deliberately no Authorization header — express.json()'s size limit
  // is registered ahead of every router, so an oversized body must be
  // rejected before requireAuth ever gets a chance to 401 it.
  const res = await request(app).patch('/api/seller/me/store').send(oversized);
  assert.equal(res.status, 413);
});

// --- 4. Pagination caps ---
//
// Every list endpoint in this codebase that accepts a client-supplied
// `limit` already runs it through utils/pagination.js's clampLimit()
// with a hard max (100-200 depending on the endpoint) — the few `.find()`
// calls that don't use it (category tree, staff lists, vehicle makes)
// never read req.query.limit at all, so there's nothing for a client to
// inflate. This section is the regression test clampLimit() itself never
// had.

test('clampLimit caps an oversized limit, falls back to the default for anything invalid', () => {
  const { clampLimit } = require('../utils/pagination');

  assert.equal(clampLimit(100000, 20, 100), 100, 'a limit far past max must be capped to max');
  assert.equal(clampLimit(undefined, 20, 100), 20, 'no limit given must use the default');
  assert.equal(clampLimit(5, 20, 100), 5, 'a valid in-range limit must pass through unchanged');
  assert.equal(clampLimit(-5, 20, 100), 20, 'a negative limit must fall back to the default');
  assert.equal(clampLimit('not-a-number', 20, 100), 20, 'a non-numeric limit must fall back to the default');
  assert.equal(clampLimit(0, 20, 100), 20, 'a zero limit must fall back to the default, not request 0 items');
});

test('?limit=100000 against a real list endpoint is capped, not honored literally', async () => {
  const res = await request(app)
    .get('/api/admin/sellers?limit=100000')
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.sellers.length <= 100, `MAX_SELLERS_LIMIT is 100 — got ${res.body.sellers.length} sellers back`);

  const publicRes = await request(app).get('/api/public/listings?limit=100000');
  assert.equal(publicRes.status, 200);
  assert.ok(publicRes.body.listings.length <= 60, `publicListingsController's MAX_LIMIT is 60 — got ${publicRes.body.listings.length} back`);
});

// --- 6. OTP codes never leak outside NODE_ENV=test ---
//
// Both debugOtpCode call sites (login OTP, bank step-up OTP) read
// process.env.NODE_ENV fresh on every request rather than caching it at
// module load — these tests briefly flip it to simulate what a
// production request would see, then restore it immediately so the rest
// of the suite (which depends on NODE_ENV=test for its own DB guard
// rails) is never affected.

async function withNodeEnv(value, fn) {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = original;
  }
}

test('login never includes debugOtpCode when NODE_ENV is not "test"', async () => {
  const prodRes = await withNodeEnv('production', () => (
    request(app).post('/api/auth/login').send({ email: 'owner@test.apexora', password: TEST_PASSWORD })
  ));
  assert.equal(prodRes.status, 200);
  assert.equal(prodRes.body.debugOtpCode, undefined, 'production must never see the OTP code in-band');

  const devRes = await withNodeEnv('development', () => (
    request(app).post('/api/auth/login').send({ email: 'owner@test.apexora', password: TEST_PASSWORD })
  ));
  assert.equal(devRes.status, 200);
  assert.equal(devRes.body.debugOtpCode, undefined, 'development must rely on the console log, not the response');

  // Sanity check — the real NODE_ENV=test the suite runs under DOES
  // return it (this is the behavior every other test's loginFlow() relies
  // on), so a change that broke the test-env case specifically would
  // still be caught even though it isn't the main thing this test checks.
  const testRes = await request(app).post('/api/auth/login').send({ email: 'owner@test.apexora', password: TEST_PASSWORD });
  assert.equal(typeof testRes.body.debugOtpCode, 'string');
});

test('bank step-up never includes debugOtpCode when NODE_ENV is not "test"', async () => {
  const prodRes = await withNodeEnv('production', () => (
    seller(request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ password: TEST_PASSWORD }), sellerA._id)
  ));
  assert.equal(prodRes.status, 200);
  assert.equal(prodRes.body.debugOtpCode, undefined);
});

// --- 9. In-memory cache for categories/vehicle makes ---

test('cache: get/set/invalidate/TTL behave as a small key-value store should', async () => {
  const cache = require('../services/cache');
  cache.clear();

  assert.equal(cache.get('x'), undefined);
  cache.set('x', { a: 1 });
  assert.deepEqual(cache.get('x'), { a: 1 });

  cache.set('category:a', 1);
  cache.set('category:b', 2);
  cache.set('vehicleMake:a', 3);
  cache.invalidate('category:');
  assert.equal(cache.get('category:a'), undefined);
  assert.equal(cache.get('category:b'), undefined);
  assert.equal(cache.get('vehicleMake:a'), 3);

  cache.set('short-lived', 'value', 10);
  assert.equal(cache.get('short-lived'), 'value');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('short-lived'), undefined, 'an expired entry must not be returned');

  cache.clear();
});

test('the public category tree reflects a new category immediately — cache invalidation, not just TTL, is what keeps it fresh', async () => {
  // Warm the cache with whatever's there before this test's category exists.
  await request(app).get('/api/public/catalog/categories');

  const createRes = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: { en: 'Cache Test Category', si: '', ta: '' }, slug: 'cache-test-category' });
  assert.equal(createRes.status, 201);

  const afterCreate = await request(app).get('/api/public/catalog/categories');
  const flatten = (nodes) => nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const names = flatten(afterCreate.body.tree).map((n) => n.name.en);
  assert.ok(names.includes('Cache Test Category'), 'a newly created category must show up without waiting for the cache TTL to expire');

  // Clean up — this is a shared-within-file database (M2 tests reuse the
  // same category tree), so this test leaves nothing behind for others.
  await Category.deleteOne({ slug: 'cache-test-category' });
  require('../services/cache').invalidate('category:');
});
