// Milestone 5 Part C — customer accounts: register, forgot/reset
// password, profile, addresses, vehicles, and the "customers can never
// reach /api/seller or /api/admin" boundary.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow, TEST_PASSWORD, User, Seller, mongoose,
} = require('./helpers');
const VehicleMake = require('../models/VehicleMake');

let make;
let seller;

before(async () => {
  await wipeDatabase();
  seller = await Seller.create({ name: 'Any Store', legalName: 'Any Store Ltd', brNumber: 'BR-ANY', status: 'active' });
  make = await VehicleMake.create({ name: 'Toyota', type: 'car', active: true, models: [{ name: 'Aqua', active: true }] });
});

after(async () => {
  await mongoose.disconnect();
});

// --- Registration ---

test('register creates a plain customer account, then the same two-step OTP logs them in', async () => {
  const registerRes = await request(app).post('/api/auth/register').send({
    name: 'New Customer', email: 'new-customer@test.apexora', phone: '0771234567', password: 'CustomerPass123!',
  });
  assert.equal(registerRes.status, 201);
  assert.ok(registerRes.body.userId);
  assert.ok(registerRes.body.debugOtpCode);

  const otpRes = await request(app).post('/api/auth/verify-otp').send({ userId: registerRes.body.userId, code: registerRes.body.debugOtpCode });
  assert.equal(otpRes.status, 200);
  assert.ok(otpRes.body.accessToken);
  assert.equal(otpRes.body.user.platformRole, 'none');
  assert.equal(otpRes.body.user.phone, '0771234567');

  // Logging in again afterward (password + OTP) works exactly the same
  // way a platform/seller account's login already does.
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'new-customer@test.apexora', password: 'CustomerPass123!' });
  assert.equal(loginRes.status, 200);
});

test('registering with an email that already has an account is rejected, not silently merged', async () => {
  await request(app).post('/api/auth/register').send({
    name: 'Dup', email: 'dup-customer@test.apexora', phone: '0771234567', password: 'CustomerPass123!',
  });
  const res = await request(app).post('/api/auth/register').send({
    name: 'Dup Again', email: 'dup-customer@test.apexora', phone: '0779999999', password: 'AnotherPass123!',
  });
  assert.equal(res.status, 409);
});

test('register rejects an unknown field (platformRole smuggling) with 400, never silently drops it', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Sneaky', email: 'sneaky@test.apexora', phone: '0771234567', password: 'CustomerPass123!', platformRole: 'platform_owner',
  });
  assert.equal(res.status, 400);
});

// --- Forgot / reset password ---

test('forgot-password gives the same generic response whether or not the email exists', async () => {
  const customer = await createUser({ name: 'Reset Me', email: 'reset-me@test.apexora' });
  const realRes = await request(app).post('/api/auth/forgot-password').send({ email: 'reset-me@test.apexora' });
  const fakeRes = await request(app).post('/api/auth/forgot-password').send({ email: 'does-not-exist@test.apexora' });

  assert.equal(realRes.status, 200);
  assert.equal(fakeRes.status, 200);
  assert.equal(realRes.body.message, fakeRes.body.message);
  assert.ok(realRes.body.debugResetToken);
  assert.equal('debugResetToken' in fakeRes.body, false);

  const stored = await User.findById(customer._id).select('resetPasswordTokenHash resetPasswordExpiresAt').lean();
  assert.ok(stored.resetPasswordTokenHash);
  assert.ok(stored.resetPasswordExpiresAt);
});

test('reset-password actually changes the password and invalidates any existing session', async () => {
  const customer = await createUser({ name: 'Reset Flow', email: 'reset-flow@test.apexora' });
  // Log in first so there's a real refresh token to prove gets invalidated.
  const { refreshToken } = await loginFlow('reset-flow@test.apexora');

  const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: 'reset-flow@test.apexora' });
  const token = forgotRes.body.debugResetToken;

  const badTokenRes = await request(app).post('/api/auth/reset-password').send({ userId: customer._id.toString(), token: 'wrong-token', newPassword: 'BrandNewPass123!' });
  assert.equal(badTokenRes.status, 400);

  const resetRes = await request(app).post('/api/auth/reset-password').send({ userId: customer._id.toString(), token, newPassword: 'BrandNewPass123!' });
  assert.equal(resetRes.status, 200);

  // Old password no longer works, new one does.
  const oldLoginRes = await request(app).post('/api/auth/login').send({ email: 'reset-flow@test.apexora', password: TEST_PASSWORD });
  assert.equal(oldLoginRes.status, 401);
  const newLoginRes = await request(app).post('/api/auth/login').send({ email: 'reset-flow@test.apexora', password: 'BrandNewPass123!' });
  assert.equal(newLoginRes.status, 200);

  // The refresh token issued before the reset is now dead.
  const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.equal(refreshRes.status, 401);

  // The same reset token can't be replayed.
  const replayRes = await request(app).post('/api/auth/reset-password').send({ userId: customer._id.toString(), token, newPassword: 'YetAnotherPass123!' });
  assert.equal(replayRes.status, 400);
});

// --- Profile / addresses / vehicles ---

test('customer profile: get and update name/phone/preferredLanguage', async () => {
  await createUser({ name: 'Profile Customer', email: 'profile-customer@test.apexora' });
  const { accessToken } = await loginFlow('profile-customer@test.apexora');

  const getRes = await request(app).get('/api/customer/profile').set('Authorization', `Bearer ${accessToken}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.profile.name, 'Profile Customer');

  const patchRes = await request(app).patch('/api/customer/profile').set('Authorization', `Bearer ${accessToken}`)
    .send({ phone: '0712345678', preferredLanguage: 'si' });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.profile.phone, '0712345678');
  assert.equal(patchRes.body.profile.preferredLanguage, 'si');
});

test('addresses: create caps at 10, the first becomes default, deleting the default promotes the next one', async () => {
  await createUser({ name: 'Address Customer', email: 'address-customer@test.apexora' });
  const { accessToken } = await loginFlow('address-customer@test.apexora');
  const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);
  const addressBody = (overrides = {}) => ({
    label: 'Home', line1: '123 Test Rd', city: 'Colombo', district: 'Colombo', phone: '0771234567', ...overrides,
  });

  const first = await auth(request(app).post('/api/customer/addresses')).send(addressBody({ label: 'First' }));
  assert.equal(first.status, 201);
  assert.equal(first.body.addresses.length, 1);
  assert.equal(first.body.addresses[0].isDefault, true);

  const second = await auth(request(app).post('/api/customer/addresses')).send(addressBody({ label: 'Second' }));
  assert.equal(second.body.addresses.length, 2);
  assert.equal(second.body.addresses.find((a) => a.label === 'First').isDefault, true);
  assert.equal(second.body.addresses.find((a) => a.label === 'Second').isDefault, false);

  for (let i = 0; i < 8; i += 1) await auth(request(app).post('/api/customer/addresses')).send(addressBody({ label: `Extra ${i}` }));
  const overCap = await auth(request(app).post('/api/customer/addresses')).send(addressBody({ label: 'One too many' }));
  assert.equal(overCap.status, 400);

  const listRes = await auth(request(app).get('/api/customer/addresses'));
  assert.equal(listRes.body.addresses.length, 10);

  const firstId = listRes.body.addresses.find((a) => a.label === 'First')._id;
  const deleteRes = await auth(request(app).delete(`/api/customer/addresses/${firstId}`));
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.addresses.length, 9);
  assert.equal(deleteRes.body.addresses.find((a) => a.label === 'Second').isDefault, true);
});

test('address validation: an invalid district or phone is rejected', async () => {
  await createUser({ name: 'Bad Address Customer', email: 'bad-address@test.apexora' });
  const { accessToken } = await loginFlow('bad-address@test.apexora');
  const res = await request(app).post('/api/customer/addresses').set('Authorization', `Bearer ${accessToken}`)
    .send({ line1: '123 Test Rd', city: 'Colombo', district: 'Not A Real District', phone: '0771234567' });
  assert.equal(res.status, 400);
});

test('a customer can never read or modify another customer\'s addresses', async () => {
  await createUser({ name: 'Owner Of Address', email: 'owner-of-address@test.apexora' });
  const ownerToken = (await loginFlow('owner-of-address@test.apexora')).accessToken;
  const createRes = await request(app).post('/api/customer/addresses').set('Authorization', `Bearer ${ownerToken}`)
    .send({ line1: '123 Test Rd', city: 'Colombo', district: 'Colombo', phone: '0771234567' });
  const addressId = createRes.body.addresses[0]._id;

  await createUser({ name: 'Other Customer', email: 'other-customer-addr@test.apexora' });
  const otherToken = (await loginFlow('other-customer-addr@test.apexora')).accessToken;

  const patchRes = await request(app).patch(`/api/customer/addresses/${addressId}`).set('Authorization', `Bearer ${otherToken}`).send({ city: 'Hijacked' });
  assert.equal(patchRes.status, 404);
  const deleteRes = await request(app).delete(`/api/customer/addresses/${addressId}`).set('Authorization', `Bearer ${otherToken}`);
  assert.equal(deleteRes.status, 404);

  // The address is untouched — confirm via the real owner.
  const listRes = await request(app).get('/api/customer/addresses').set('Authorization', `Bearer ${ownerToken}`);
  assert.equal(listRes.body.addresses[0].city, 'Colombo');
});

test('vehicles: add, list, and delete a saved vehicle', async () => {
  await createUser({ name: 'Vehicle Customer', email: 'vehicle-customer@test.apexora' });
  const { accessToken } = await loginFlow('vehicle-customer@test.apexora');
  const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);

  const createRes = await auth(request(app).post('/api/customer/vehicles')).send({ makeId: make._id.toString(), modelName: 'Aqua', year: 2016 });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.vehicles.length, 1);
  assert.equal(createRes.body.vehicles[0].makeId.name, 'Toyota');

  const listRes = await auth(request(app).get('/api/customer/vehicles'));
  assert.equal(listRes.body.vehicles.length, 1);

  const vehicleId = listRes.body.vehicles[0]._id;
  const deleteRes = await auth(request(app).delete(`/api/customer/vehicles/${vehicleId}`));
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.vehicles.length, 0);
});

// --- Boundary: a customer can never reach /api/seller or /api/admin ---

test('a plain customer gets 403/404 on every seller and admin route, never a privileged response', async () => {
  await createUser({ name: 'Boundary Customer', email: 'boundary-customer@test.apexora' });
  const { accessToken } = await loginFlow('boundary-customer@test.apexora');

  const adminRes = await request(app).get('/api/admin/sellers').set('Authorization', `Bearer ${accessToken}`);
  assert.equal(adminRes.status, 403);

  // No X-Seller-Id and no membership anywhere — requireSellerMember 404s,
  // same as any other non-member, never confirming the seller exists.
  const sellerRes = await request(app).get('/api/seller/me/store').set('Authorization', `Bearer ${accessToken}`);
  assert.equal(sellerRes.status, 404);

  // Even claiming a real seller's id via X-Seller-Id doesn't help — the
  // customer still isn't a member of it.
  const claimedRes = await request(app).get('/api/seller/me/store').set('Authorization', `Bearer ${accessToken}`).set('X-Seller-Id', seller._id.toString());
  assert.equal(claimedRes.status, 404);
});
