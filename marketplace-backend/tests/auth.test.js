const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, wipeDatabase, createUser, mongoose } = require('./helpers');

before(async () => {
  await wipeDatabase();
});

// Without this, the open Mongoose connection keeps Node's event loop alive
// indefinitely after the last test finishes — every test passes but the
// process never exits (discovered the hard way: a 30s --test-timeout on
// individual tests doesn't help here, since nothing is actually hung,
// there's just an open handle with nothing left to close it).
after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await wipeDatabase();
  await createUser({ name: 'Alice', email: 'alice@test.apexora', platformRole: 'none' });
});

test('login -> verify-otp -> refresh -> logout -> refresh fails (full real HTTP flow)', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'alice@test.apexora', password: 'TestPass123!' });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.userId);
  assert.ok(loginRes.body.debugOtpCode, 'test env should return debugOtpCode');

  const otpRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({ userId: loginRes.body.userId, code: loginRes.body.debugOtpCode });
  assert.equal(otpRes.status, 200);
  assert.ok(otpRes.body.accessToken);
  assert.ok(otpRes.body.refreshToken);
  assert.equal(otpRes.body.user.email, 'alice@test.apexora');

  const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: otpRes.body.refreshToken });
  assert.equal(refreshRes.status, 200);
  assert.ok(refreshRes.body.accessToken);

  const logoutRes = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${otpRes.body.accessToken}`);
  assert.equal(logoutRes.status, 200);

  const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken: otpRes.body.refreshToken });
  assert.equal(refreshAfterLogout.status, 401, 'refresh token must be invalid after logout');
});

test('wrong password is rejected with a generic message (401)', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.apexora', password: 'WrongPassword!' });
  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Invalid credentials');
});

test('unknown email gets the SAME generic message as wrong password (no enumeration)', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.apexora', password: 'whatever' });
  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Invalid credentials');
});

test('wrong OTP code is rejected', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'alice@test.apexora', password: 'TestPass123!' });
  const res = await request(app).post('/api/auth/verify-otp').send({ userId: loginRes.body.userId, code: '000000' });
  assert.equal(res.status, 401);
});

test('OTP code is single-use — cannot be replayed', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'alice@test.apexora', password: 'TestPass123!' });
  const code = loginRes.body.debugOtpCode;
  const first = await request(app).post('/api/auth/verify-otp').send({ userId: loginRes.body.userId, code });
  assert.equal(first.status, 200);
  const replay = await request(app).post('/api/auth/verify-otp').send({ userId: loginRes.body.userId, code });
  assert.equal(replay.status, 401, 'replaying the same OTP code must fail');
});

test('privileged field (platformRole) in /login body is rejected with 400, not silently dropped', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice@test.apexora', password: 'TestPass123!', platformRole: 'platform_owner' });
  assert.equal(res.status, 400);
  assert.match(JSON.stringify(res.body.errors), /platformRole/);
});

test('privileged field (status) in /login body is rejected with 400', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice@test.apexora', password: 'TestPass123!', status: 'active' });
  assert.equal(res.status, 400);
});

test('logged-out request to a protected route gets 401', async () => {
  const res = await request(app).get('/api/admin/sellers');
  assert.equal(res.status, 401);
});

test('malformed Bearer token gets 401, not a 500', async () => {
  const res = await request(app).get('/api/admin/sellers').set('Authorization', 'Bearer not-a-real-token');
  assert.equal(res.status, 401);
});
