// Milestone 11 — request ids, error responses, health check, ops alerts.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, MessageOutbox, Notification, Seller, mongoose,
} = require('./helpers');
const Payout = require('../models/Payout');
const { checkOpsAlerts, resetAlertsForTests } = require('../services/opsAlerts');
const { errorHandler } = require('../middleware/errorHandler');

let owner;

before(async () => {
  await wipeDatabase();
  await Payout.deleteMany({});
  owner = await createUser({ name: 'Owner', email: 'owner11@test.apexora', platformRole: 'platform_owner' });
});

afterEach(() => resetAlertsForTests());

after(async () => {
  await Payout.deleteMany({});
  await mongoose.disconnect();
});

function fakeRes() {
  return { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

test('every response carries a request id; a sane incoming id is kept, a bad one replaced', async () => {
  const plain = await request(app).get('/api/public/settings');
  assert.match(plain.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  const kept = await request(app).get('/api/public/settings').set('X-Request-Id', 'edge-abc12345');
  assert.equal(kept.headers['x-request-id'], 'edge-abc12345');
  const replaced = await request(app).get('/api/public/settings').set('X-Request-Id', 'bad id with spaces <script>');
  assert.notEqual(replaced.headers['x-request-id'], 'bad id with spaces <script>');
});

test('malformed JSON is a 400 and an oversized body a 413, not a 500', async () => {
  const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
  assert.equal(bad.status, 400);
  assert.ok(bad.body.requestId);
  const big = await request(app).post('/api/auth/login').send({ email: 'x@y.z', password: 'a'.repeat(300 * 1024) });
  assert.equal(big.status, 413);
});

test('a request from an origin outside the allow-list is refused with 403', async () => {
  const res = await request(app).get('/api/public/settings').set('Origin', 'https://evil.example');
  assert.equal(res.status, 403);
});

test('in production a 5xx hides the internal message but keeps the request id', () => {
  const original = process.env.NODE_ENV;
  const err = console.error;
  console.error = () => {};
  try {
    process.env.NODE_ENV = 'production';
    const res = fakeRes();
    errorHandler(new Error("Cannot read properties of undefined (reading 'map')"), { id: 'req-1', originalUrl: '/x' }, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Something went wrong. Please try again.');
    assert.equal(res.body.requestId, 'req-1');

    const client = fakeRes();
    const notFound = Object.assign(new Error('Order not found'), { statusCode: 404 });
    errorHandler(notFound, { id: 'req-2', originalUrl: '/y' }, client, () => {});
    assert.equal(client.body.message, 'Order not found', '4xx messages are meant for the user and stay');
  } finally {
    process.env.NODE_ENV = original;
    console.error = err;
  }
});

test('/health reports the database and queue state', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, 'up');
  assert.deepEqual(res.body.outbox, { overdue: 0, failedLastHour: 0 });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal((await request(app).get('/api/health')).status, 200);
});

test('an outbox backlog alerts platform owners once, not on every check', async () => {
  const old = new Date(Date.now() - 30 * 60e3);
  await MessageOutbox.insertMany(Array.from({ length: 20 }, (_, i) => ({ channel: 'email', to: `q${i}@test.apexora`, template: 'order.placed', body: 'x', status: 'pending', nextAttemptAt: old })));
  const log = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await checkOpsAlerts(), ['outbox.backlog']);
    const alerts = await Notification.find({ user: owner._id, type: 'ops.alert' }).lean();
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].title, /20 emails\/SMS are stuck/);
    assert.deepEqual(await checkOpsAlerts(), [], 'repeats are suppressed');
    assert.equal(await Notification.countDocuments({ type: 'ops.alert' }), 1);
  } finally {
    console.error = log;
  }
  await MessageOutbox.deleteMany({});
});

test('a failed payout in the last day raises an alert', async () => {
  const seller = await Seller.create({ name: 'S11', legalName: 'S11 Ltd', brNumber: 'BR-11', status: 'active', slug: 's11' });
  await Payout.collection.insertOne({ seller: seller._id, status: 'failed', failedAt: new Date(), failedReason: 'Account closed', netCents: 5000 });
  const log = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await checkOpsAlerts(), ['payout.failed']);
  } finally {
    console.error = log;
  }
  const health = await request(app).get('/health');
  assert.equal(health.body.payouts.failedLastDay, 1);
});

// --- Key rotation ---

test('JWTs signed with the previous secret keep working during a rotation', () => {
  const jwt = require('jsonwebtoken');
  const { verifyAccessToken } = require('../services/tokens');
  const saved = { cur: process.env.JWT_ACCESS_SECRET, prev: process.env.JWT_ACCESS_SECRET_PREVIOUS };
  try {
    const oldToken = jwt.sign({ id: 'u1' }, 'old-secret-for-rotation-test', { expiresIn: '5m' });
    process.env.JWT_ACCESS_SECRET = 'new-secret-for-rotation-test';
    delete process.env.JWT_ACCESS_SECRET_PREVIOUS;
    assert.throws(() => verifyAccessToken(oldToken), /invalid signature/);
    process.env.JWT_ACCESS_SECRET_PREVIOUS = 'old-secret-for-rotation-test';
    assert.equal(verifyAccessToken(oldToken).id, 'u1');
    const expired = jwt.sign({ id: 'u1', exp: Math.floor(Date.now() / 1000) - 10 }, 'old-secret-for-rotation-test');
    assert.throws(() => verifyAccessToken(expired), /expired/, 'an expired token is not rescued by the old key');
  } finally {
    process.env.JWT_ACCESS_SECRET = saved.cur;
    if (saved.prev === undefined) delete process.env.JWT_ACCESS_SECRET_PREVIOUS; else process.env.JWT_ACCESS_SECRET_PREVIOUS = saved.prev;
  }
});

test('POS keys encrypted with the old secret are re-encrypted by the rotation script', async () => {
  const { encrypt, decrypt, isCurrentKey } = require('../services/encryption');
  const { rotatePosKeys } = require('../scripts/rotate-pos-key');
  const saved = { cur: process.env.POS_KEY_ENCRYPTION_SECRET, prev: process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS };
  const OLD = 'a'.repeat(64);
  const NEW = 'b'.repeat(64);
  try {
    process.env.POS_KEY_ENCRYPTION_SECRET = OLD;
    const seller = await Seller.create({ name: 'POS11', legalName: 'POS11 Ltd', brNumber: 'BR-P11', status: 'active', slug: 'pos11', posConnection: { enabled: true, baseUrl: 'http://x', encryptedKey: encrypt('integration-key-123'), keyLast4: '0123' } });

    process.env.POS_KEY_ENCRYPTION_SECRET = NEW;
    process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS = OLD;
    const before = (await Seller.findById(seller._id).select('+posConnection.encryptedKey')).posConnection.encryptedKey;
    assert.equal(isCurrentKey(before), false);
    assert.equal(decrypt(before), 'integration-key-123', 'still readable during the rotation');

    assert.deepEqual(await rotatePosKeys(), { checked: 1, rotated: 1, failed: 0 });
    delete process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS;
    const after = (await Seller.findById(seller._id).select('+posConnection.encryptedKey')).posConnection.encryptedKey;
    assert.equal(decrypt(after), 'integration-key-123', 'readable with the new key alone');
    assert.deepEqual(await rotatePosKeys(), { checked: 1, rotated: 0, failed: 0 }, 'a second run has nothing to do');
  } finally {
    process.env.POS_KEY_ENCRYPTION_SECRET = saved.cur;
    if (saved.prev === undefined) delete process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS; else process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS = saved.prev;
  }
});
