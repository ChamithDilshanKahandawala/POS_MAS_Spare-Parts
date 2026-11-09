// Milestone 10 — Admin → Customers: search, detail, deactivate/reactivate,
// password reset link.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, User, Category, Listing, PlatformSettings, AuditLog, mongoose,
} = require('./helpers');

const name = (en) => ({ en, si: '', ta: '' });
let tokens = {};
let customer, other, sellerOwner;

before(async () => {
  await wipeDatabase();
  await createUser({ name: 'Owner', email: 'owner10c@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Staff', email: 'staff10c@test.apexora', platformRole: 'platform_staff' });
  customer = await createUser({ name: 'Nimal Perera', email: 'nimal10@test.apexora' });
  other = await createUser({ name: 'Kamala Silva', email: 'kamala10@test.apexora' });
  sellerOwner = await createUser({ name: 'Shop Owner', email: 'shop10@test.apexora' });
  await User.updateOne({ _id: customer._id }, { $set: { phone: '+94771234567' } });

  const seller = await Seller.create({ name: 'Shop Ten', legalName: 'Shop Ten Ltd', brNumber: 'BR-10', status: 'active', slug: 'shop-ten' });
  await SellerMember.create({ user: sellerOwner._id, seller: seller._id, role: 'seller_owner' });
  const category = await Category.create({ name: name('Parts'), slug: 'parts-m10c', depth: 0, active: true, commissionRateBps: 500 });
  const listing = await Listing.create({ seller: seller._id, categoryId: category._id, status: 'published', stock: 20, priceCents: 50000, weightGrams: 300, title: name('Filter'), publishedAt: new Date() });
  await PlatformSettings.create({ _id: 'platform-settings', onlineOrderingEnabled: true });

  tokens.owner = (await loginFlow('owner10c@test.apexora')).accessToken;
  tokens.staff = (await loginFlow('staff10c@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('nimal10@test.apexora')).accessToken;
  const session = await loginFlow('kamala10@test.apexora');
  tokens.other = session.accessToken;
  tokens.otherRefresh = session.refreshToken;

  const c = await User.findById(customer._id);
  c.addresses.push({ line1: '42 Galle Road', city: 'Colombo', district: 'Colombo', phone: '0770001010', isDefault: true });
  await c.save();
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId: c.addresses[0]._id.toString(), items: [{ listingId: listing._id.toString(), qty: 2 }], idempotencyKey: 'idem-m10c-1',
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
});

after(async () => {
  await mongoose.disconnect();
});

const admin = (method, path, token = tokens.staff) => request(app)[method](`/api/admin/customers${path}`).set('Authorization', `Bearer ${token}`);

test('only platform staff can use Admin → Customers', async () => {
  assert.equal((await admin('get', '', tokens.customer)).status, 403);
});

test('the list shows customers only, with order counts, a seller flag and masked phones', async () => {
  const res = await admin('get', '');
  assert.equal(res.status, 200);
  const emails = res.body.customers.map((c) => c.email);
  assert.ok(emails.includes('nimal10@test.apexora'));
  assert.ok(emails.includes('shop10@test.apexora'), 'a seller who could also shop is listed');
  assert.ok(!emails.includes('staff10c@test.apexora'), 'platform accounts are not customers');

  const nimal = res.body.customers.find((c) => c.email === 'nimal10@test.apexora');
  assert.equal(nimal.orderCount, 1);
  assert.ok(nimal.lastOrderAt);
  assert.equal(nimal.phone, '+9477***67');
  assert.equal(res.body.customers.find((c) => c.email === 'shop10@test.apexora').isSellerMember, true);
});

test('search matches name, email or phone, and treats input literally', async () => {
  const byName = await admin('get', '?q=perera');
  assert.deepEqual(byName.body.customers.map((c) => c.email), ['nimal10@test.apexora']);
  const byPhone = await admin('get', '?q=771234');
  assert.deepEqual(byPhone.body.customers.map((c) => c.email), ['nimal10@test.apexora']);
  const regexy = await admin('get', `?q=${encodeURIComponent('.*')}`);
  assert.equal(regexy.body.customers.length, 0);
});

test('detail shows orders with parcels and masked addresses, never the password', async () => {
  const res = await admin('get', `/${customer._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.stats.orderCount, 1);
  assert.equal(res.body.stats.totalCents, res.body.orders[0].grandTotalCents);
  assert.equal(res.body.orders[0].parcels[0].seller, 'Shop Ten');
  assert.equal(res.body.customer.addresses[0].line1, '42 ***');
  assert.equal(res.body.customer.addresses[0].city, 'Colombo');
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes('password') && !raw.includes('Galle'), 'no password field, no full street line');

  const staffUser = await User.findOne({ email: 'staff10c@test.apexora' });
  assert.equal((await admin('get', `/${staffUser._id}`)).status, 404, 'platform accounts are not reachable here');
});

test('deactivating needs a reason, is audited, and locks the customer out at once', async () => {
  const noReason = await admin('post', `/${other._id}/deactivate`).send({ reason: '' });
  assert.equal(noReason.status, 400);

  const res = await admin('post', `/${other._id}/deactivate`).send({ reason: 'Repeated fake COD orders' });
  assert.equal(res.status, 200);
  assert.equal(res.body.customer.isActive, false);
  assert.equal(res.body.customer.deactivationReason, 'Repeated fake COD orders');

  const audit = await AuditLog.findOne({ action: 'customer.deactivate', targetId: String(other._id) }).lean();
  assert.match(audit.summary, /fake COD/);

  const withOldToken = await request(app).get('/api/customer/orders').set('Authorization', `Bearer ${tokens.other}`);
  assert.equal(withOldToken.status, 403, 'an existing access token stops working');
  const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: tokens.otherRefresh });
  assert.equal(refresh.status, 401, 'the refresh session is gone');
  const login = await request(app).post('/api/auth/login').send({ email: 'kamala10@test.apexora', password: 'TestPass123!' });
  assert.equal(login.status, 403);

  assert.equal((await admin('post', `/${other._id}/deactivate`).send({ reason: 'again please' })).status, 409);
  assert.equal((await admin('get', '?status=deactivated')).body.customers.map((c) => c.email).join(), 'kamala10@test.apexora');
});

test('a deactivated customer cannot be sent a reset link; reactivating restores login', async () => {
  assert.equal((await admin('post', `/${other._id}/send-password-reset`).send({})).status, 409);

  const res = await admin('post', `/${other._id}/reactivate`).send({ reason: 'Verified by phone' });
  assert.equal(res.status, 200);
  assert.equal(res.body.customer.isActive, true);
  assert.ok(await AuditLog.exists({ action: 'customer.reactivate', targetId: String(other._id) }));
  assert.ok(await loginFlow('kamala10@test.apexora'));
});

test('staff can email a password reset link, which then works', async () => {
  const res = await admin('post', `/${customer._id}/send-password-reset`).send({});
  assert.equal(res.status, 200);
  const reset = await request(app).post('/api/auth/reset-password').send({ userId: customer._id.toString(), token: res.body.debugResetToken, newPassword: 'NewPass456!' });
  assert.equal(reset.status, 200);
  assert.ok(await loginFlow('nimal10@test.apexora', 'NewPass456!'));
  assert.ok(await AuditLog.exists({ action: 'customer.password_reset_sent' }));
});

test('an older account stored without an addresses field still opens', async () => {
  const { insertedId } = await User.collection.insertOne({ name: 'Legacy', email: 'legacy10@test.apexora', password: 'x', platformRole: 'none', isActive: true, createdAt: new Date() });
  const res = await admin('get', `/${insertedId}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.customer.addresses, []);
});
