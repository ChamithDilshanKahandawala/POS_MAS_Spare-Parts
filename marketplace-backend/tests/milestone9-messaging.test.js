// Milestone 9 — email/SMS delivery: OTP channel rules and throttling, the
// outbox worker's retries, templates, preferences and the admin message log.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, User, Category, Listing, PlatformSettings, MessageOutbox, mongoose,
} = require('./helpers');
const { TEMPLATES, LANGUAGES, renderTemplate } = require('../services/messageTemplates');
const { processOutbox, setProviderForTests, testOutbox, toE164, MAX_ATTEMPTS } = require('../services/messaging');

const name = (en) => ({ en, si: '', ta: '' });
const idemKey = () => `idem9-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const lastSent = () => testOutbox[testOutbox.length - 1];

let seller, listing, ownerUser, customer;
let tokens = {};
let addressId;

function failingProvider(times) {
  let calls = 0;
  return {
    name: 'fake',
    calls: () => calls,
    async send() {
      calls += 1;
      if (calls <= times) throw new Error(`provider down (call ${calls})`);
      return { id: `fake-${calls}` };
    },
  };
}

async function placeOrder() {
  const res = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId, items: [{ listingId: listing._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

before(async () => {
  await wipeDatabase();
  ownerUser = await createUser({ name: 'Platform Owner', email: 'owner9@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Platform Staff', email: 'staff9@test.apexora', platformRole: 'platform_staff' });
  const sellerOwner = await createUser({ name: 'Seller Owner', email: 'seller9@test.apexora' });
  customer = await createUser({ name: 'Customer', email: 'customer9@test.apexora' });

  const category = await Category.create({ name: name('Parts'), slug: 'parts-m9', depth: 0, active: true, commissionRateBps: 500 });
  seller = await Seller.create({ name: 'Seller Nine', legalName: 'Seller Nine Ltd', brNumber: 'BR-9', status: 'active', slug: 'seller-m9' });
  await SellerMember.create({ user: sellerOwner._id, seller: seller._id, role: 'seller_owner' });
  listing = await Listing.create({ seller: seller._id, categoryId: category._id, status: 'published', stock: 100, priceCents: 150000, weightGrams: 500, title: name('Brake Pad'), publishedAt: new Date() });
  await PlatformSettings.create({ _id: 'platform-settings', onlineOrderingEnabled: true });

  tokens.owner = (await loginFlow('owner9@test.apexora')).accessToken;
  tokens.staff = (await loginFlow('staff9@test.apexora')).accessToken;
  tokens.seller = (await loginFlow('seller9@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer9@test.apexora')).accessToken;

  const c = await User.findById(customer._id);
  c.addresses.push({ line1: '9 Message Lane', city: 'Colombo', district: 'Colombo', phone: '0770000009', isDefault: true });
  await c.save();
  addressId = c.addresses[0]._id.toString();
});

afterEach(() => {
  setProviderForTests('email', null);
  setProviderForTests('sms', null);
  process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
  process.env.OTP_DAILY_LIMIT = '1000';
});

after(async () => {
  await mongoose.disconnect();
});

// --- Templates ---

test('every template has subject and text in en/si/ta, SMS copy in all three or none, and the same placeholders', () => {
  const placeholders = (text) => [...(text || '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
  for (const [key, def] of Object.entries(TEMPLATES)) {
    for (const lang of LANGUAGES) {
      assert.ok(def[lang]?.subject && def[lang]?.text, `${key} is missing ${lang} subject/text`);
      assert.equal(!!def[lang].sms, !!def.en.sms, `${key}: ${lang} SMS copy should exist exactly when English does`);
      assert.equal(placeholders(def[lang].text), placeholders(def.en.text), `${key}: ${lang} text placeholders differ from en`);
      assert.equal(placeholders(def[lang].subject), placeholders(def.en.subject), `${key}: ${lang} subject placeholders differ from en`);
      if (def.en.sms) assert.equal(placeholders(def[lang].sms), placeholders(def.en.sms), `${key}: ${lang} SMS placeholders differ from en`);
    }
    if (def.outcomes) for (const lang of LANGUAGES) assert.ok(def.outcomes[lang]?.refund && def.outcomes[lang]?.dismissed, `${key} outcomes missing for ${lang}`);
  }
  const si = renderTemplate('return.decided', 'si', { requestNumber: 'RTN-1', orderNumber: 'APX-1', decision: 'refund', note: '' });
  assert.match(si.text, /අනුමතයි/);
});

test('Sri Lankan phone numbers normalise to E.164', () => {
  assert.equal(toE164('0771234567'), '+94771234567');
  assert.equal(toE164('+94 77 123 4567'), '+94771234567');
  assert.equal(toE164('771234567'), '+94771234567');
  assert.equal(toE164('12345'), null);
});

// --- OTP delivery ---

test('login OTP goes by email when the user has no phone, and the stored row never contains the code', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'customer9@test.apexora', password: 'TestPass123!' });
  assert.equal(res.status, 200);
  const sent = lastSent();
  assert.equal(sent.channel, 'email');
  assert.equal(sent.to, 'customer9@test.apexora');
  assert.ok(sent.text.includes(res.body.debugOtpCode), 'the real email carries the code');

  const row = await MessageOutbox.findOne({ template: 'otp.login', to: 'customer9@test.apexora' }).sort({ createdAt: -1 }).lean();
  assert.equal(row.status, 'sent');
  assert.equal(row.redacted, true);
  assert.ok(!row.body.includes(res.body.debugOtpCode), 'the stored copy is masked');
});

test('login OTP goes by SMS when the user has a phone', async () => {
  await User.updateOne({ email: 'staff9@test.apexora' }, { $set: { phone: '077 123 4567' } });
  const res = await request(app).post('/api/auth/login').send({ email: 'staff9@test.apexora', password: 'TestPass123!' });
  assert.equal(res.status, 200);
  assert.equal(lastSent().channel, 'sms');
  assert.equal(lastSent().to, '+94771234567');
  assert.ok(lastSent().text.includes(res.body.debugOtpCode));
  await User.updateOne({ email: 'staff9@test.apexora' }, { $set: { phone: '' } });
});

test('debugOtpCode is only ever returned under NODE_ENV=test', async () => {
  const original = process.env.NODE_ENV;
  const log = console.log;
  try {
    console.log = () => {};
    const stub = { name: 'stub', async send() { return { id: 'stub-1' }; } };
    setProviderForTests('email', stub);
    setProviderForTests('sms', stub);
    for (const env of ['development', 'production']) {
      process.env.NODE_ENV = env;
      const login = await request(app).post('/api/auth/login').send({ email: 'owner9@test.apexora', password: 'TestPass123!' });
      assert.equal(login.status, 200);
      assert.equal(login.body.debugOtpCode, undefined, `login leaked the code in ${env}`);
      const stepUp = await request(app).post('/api/admin/step-up').set('Authorization', `Bearer ${tokens.owner}`).send({ password: 'TestPass123!' });
      assert.equal(stepUp.status, 200);
      assert.equal(stepUp.body.debugOtpCode, undefined, `step-up leaked the code in ${env}`);
    }
  } finally {
    process.env.NODE_ENV = original;
    console.log = log;
  }
});

test('a second code within the cooldown is refused with 429', async () => {
  await User.updateOne({ email: 'seller9@test.apexora' }, { $set: { otpLastSentAt: null } });
  process.env.OTP_RESEND_COOLDOWN_SECONDS = '60';
  const first = await request(app).post('/api/auth/login').send({ email: 'seller9@test.apexora', password: 'TestPass123!' });
  assert.equal(first.status, 200);
  const second = await request(app).post('/api/auth/login').send({ email: 'seller9@test.apexora', password: 'TestPass123!' });
  assert.equal(second.status, 429);
  assert.match(second.body.message, /wait \d+ seconds/);
});

test('the daily cap is shared by login and step-up codes', async () => {
  await User.updateOne({ _id: ownerUser._id }, { $set: { otpSendCount: 0, otpSendDay: null } });
  process.env.OTP_DAILY_LIMIT = '2';
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'owner9@test.apexora', password: 'TestPass123!' })).status, 200);
  assert.equal((await request(app).post('/api/admin/step-up').set('Authorization', `Bearer ${tokens.owner}`).send({ password: 'TestPass123!' })).status, 200);
  const third = await request(app).post('/api/auth/login').send({ email: 'owner9@test.apexora', password: 'TestPass123!' });
  assert.equal(third.status, 429);
  assert.match(third.body.message, /today/);
});

test('a failed OTP send returns 502 and does not use up the cooldown', async () => {
  process.env.OTP_RESEND_COOLDOWN_SECONDS = '60';
  await User.updateOne({ email: 'customer9@test.apexora' }, { $set: { otpLastSentAt: null } });
  setProviderForTests('email', failingProvider(1));
  const failed = await request(app).post('/api/auth/login').send({ email: 'customer9@test.apexora', password: 'TestPass123!' });
  assert.equal(failed.status, 502);
  const row = await MessageOutbox.findOne({ template: 'otp.login', status: 'failed' }).lean();
  assert.match(row.lastError, /provider down/);

  const retried = await request(app).post('/api/auth/login').send({ email: 'customer9@test.apexora', password: 'TestPass123!' });
  assert.equal(retried.status, 200, 'the user can ask again straight away');
});

// --- Outbox ---

test('placing an order queues an email for the customer and the seller owner, in the customer\'s language', async () => {
  await User.updateOne({ _id: customer._id }, { $set: { preferredLanguage: 'si' } });
  await MessageOutbox.deleteMany({});
  const placed = await placeOrder();

  const rows = await MessageOutbox.find({}).lean();
  const customerRow = rows.find((r) => r.template === 'order.placed');
  const sellerRow = rows.find((r) => r.template === 'order.new');
  assert.ok(customerRow && sellerRow, `expected both rows, got ${rows.map((r) => r.template)}`);
  assert.equal(customerRow.status, 'pending');
  assert.equal(customerRow.language, 'si');
  assert.ok(customerRow.body.includes(placed.order.orderNumber));
  assert.match(customerRow.subject, /ඇණවුම/);
  assert.equal(sellerRow.to, 'seller9@test.apexora');

  const counts = await processOutbox();
  assert.equal(counts.sent, 2);
  assert.equal(await MessageOutbox.countDocuments({ status: 'sent' }), 2);
  await User.updateOne({ _id: customer._id }, { $set: { preferredLanguage: 'en' } });
});

test('the worker retries with backoff and gives up after the maximum attempts', async () => {
  await MessageOutbox.deleteMany({});
  await placeOrder();
  await MessageOutbox.deleteMany({ template: { $ne: 'order.placed' } });
  const row = await MessageOutbox.findOne({ template: 'order.placed' });

  const provider = failingProvider(2);
  setProviderForTests('email', provider);
  const t0 = new Date();
  await processOutbox({ now: t0 });
  let after1 = await MessageOutbox.findById(row._id).lean();
  assert.equal(after1.status, 'pending');
  assert.equal(after1.attempts, 1);
  assert.equal(after1.nextAttemptAt.getTime(), t0.getTime() + 60e3, 'first retry after 1 minute');

  const early = await processOutbox({ now: new Date(t0.getTime() + 30e3) });
  assert.equal(early.sent + early.retry, 0, 'not retried before its time');

  await processOutbox({ now: new Date(t0.getTime() + 61e3) });
  const after2 = await MessageOutbox.findById(row._id).lean();
  assert.equal(after2.attempts, 2);
  assert.equal(after2.nextAttemptAt.getTime(), t0.getTime() + 61e3 + 5 * 60e3, 'second retry after 5 minutes');

  await processOutbox({ now: new Date(t0.getTime() + 61e3 + 5 * 60e3 + 1) });
  const sent = await MessageOutbox.findById(row._id).lean();
  assert.equal(sent.status, 'sent');
  assert.equal(sent.providerMessageId, 'fake-3');
  assert.equal(provider.calls(), 3);

  // Always failing: ends as failed after MAX_ATTEMPTS.
  await MessageOutbox.updateOne({ _id: row._id }, { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(0) } });
  setProviderForTests('email', failingProvider(100));
  for (let i = 0; i < MAX_ATTEMPTS; i++) await processOutbox({ now: new Date(Date.now() + i * 10 * 3600e3 + 1e6) });
  const dead = await MessageOutbox.findById(row._id).lean();
  assert.equal(dead.status, 'failed');
  assert.equal(dead.attempts, MAX_ATTEMPTS);
});

test('a message stuck in "sending" (crashed worker) is picked up again once its lock expires', async () => {
  const row = await MessageOutbox.create({ channel: 'email', to: 'x@test.apexora', template: 'order.delivered', body: 'hi', status: 'sending', lockedUntil: new Date(Date.now() - 1000), attempts: 1 });
  await processOutbox();
  assert.equal((await MessageOutbox.findById(row._id).lean()).status, 'sent');
});

// --- Preferences ---

test('a seller who turns off order emails stops getting them; security codes still arrive', async () => {
  const prefs = await request(app).patch('/api/seller/me/notification-preferences')
    .set('Authorization', `Bearer ${tokens.seller}`).set('X-Seller-Id', seller._id.toString())
    .send({ orders: { email: false } });
  assert.equal(prefs.status, 200);
  assert.equal(prefs.body.preferences.orders.email, false);
  assert.equal(prefs.body.preferences.returns.email, true);

  const bad = await request(app).patch('/api/seller/me/notification-preferences')
    .set('Authorization', `Bearer ${tokens.seller}`).set('X-Seller-Id', seller._id.toString())
    .send({ security: { email: false } });
  assert.equal(bad.status, 400, 'security messages have no switch');

  await MessageOutbox.deleteMany({});
  await placeOrder();
  assert.equal(await MessageOutbox.countDocuments({ template: 'order.new' }), 0);
  assert.equal(await MessageOutbox.countDocuments({ template: 'order.placed' }), 1, 'the customer is unaffected');

  const login = await request(app).post('/api/auth/login').send({ email: 'seller9@test.apexora', password: 'TestPass123!' });
  assert.equal(login.status, 200);
  assert.equal(lastSent().to, 'seller9@test.apexora');

  const read = await request(app).get('/api/seller/me/notification-preferences')
    .set('Authorization', `Bearer ${tokens.seller}`).set('X-Seller-Id', seller._id.toString());
  assert.deepEqual(read.body.groups, ['orders', 'returns', 'payouts']);
});

// --- Admin message log ---

test('admin message log masks recipients, retries failed messages, and refuses to resend secrets', async () => {
  await MessageOutbox.deleteMany({});
  const failed = await MessageOutbox.create({ channel: 'email', to: 'customer9@test.apexora', template: 'order.placed', body: 'x', status: 'failed', attempts: MAX_ATTEMPTS, lastError: 'boom' });
  const secret = await MessageOutbox.create({ channel: 'sms', to: '+94771234567', template: 'otp.login', body: 'code ••••••', redacted: true, status: 'failed' });

  const customerTry = await request(app).get('/api/admin/messages').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(customerTry.status, 403);

  const list = await request(app).get('/api/admin/messages?status=failed').set('Authorization', `Bearer ${tokens.staff}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.failedCount, 2);
  const emails = list.body.messages.map((m) => m.to);
  assert.ok(emails.includes('c***@test.apexora'));
  assert.ok(emails.includes('+9477***67'));

  const retried = await request(app).post(`/api/admin/messages/${failed._id}/retry`).set('Authorization', `Bearer ${tokens.staff}`).send({});
  assert.equal(retried.status, 200);
  assert.equal(retried.body.message.status, 'pending');
  await processOutbox();
  assert.equal((await MessageOutbox.findById(failed._id).lean()).status, 'sent');

  const again = await request(app).post(`/api/admin/messages/${failed._id}/retry`).set('Authorization', `Bearer ${tokens.staff}`).send({});
  assert.equal(again.status, 409, 'only failed messages can be retried');

  const secretRetry = await request(app).post(`/api/admin/messages/${secret._id}/retry`).set('Authorization', `Bearer ${tokens.staff}`).send({});
  assert.equal(secretRetry.status, 409);
  assert.match(secretRetry.body.message, /request a new one/);
});

test('password reset and staff invite links are emailed but never stored', async () => {
  await MessageOutbox.deleteMany({});
  const reset = await request(app).post('/api/auth/forgot-password').send({ email: 'customer9@test.apexora' });
  assert.equal(reset.status, 200);
  assert.ok(lastSent().text.includes(reset.body.debugResetToken));
  const resetRow = await MessageOutbox.findOne({ template: 'password.reset' }).lean();
  assert.ok(!resetRow.body.includes(reset.body.debugResetToken));

  const invite = await request(app).post('/api/admin/platform-staff/invite').set('Authorization', `Bearer ${tokens.owner}`).send({ email: 'new-staff9@test.apexora' });
  assert.ok([200, 201].includes(invite.status), JSON.stringify(invite.body));
  assert.equal(lastSent().to, 'new-staff9@test.apexora');
  assert.match(lastSent().text, /\/invite\//);
  const inviteRow = await MessageOutbox.findOne({ template: 'invite.platform_staff' }).lean();
  assert.ok(!/\/invite\/\w/.test(inviteRow.body), 'the stored copy has no usable invite link');
});

test('changing the phone that receives codes needs the password, normalises the number, and emails the account', async () => {
  const auth = (r) => r.set('Authorization', `Bearer ${tokens.seller}`);
  const wrong = await auth(request(app).patch('/api/auth/me/phone')).send({ phone: '0771112233', password: 'nope' });
  assert.equal(wrong.status, 401);
  const invalid = await auth(request(app).patch('/api/auth/me/phone')).send({ phone: '12345', password: 'TestPass123!' });
  assert.equal(invalid.status, 400);

  await MessageOutbox.deleteMany({});
  const ok = await auth(request(app).patch('/api/auth/me/phone')).send({ phone: '077 111 2233', password: 'TestPass123!' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.phone, '+94771112233');
  const alert = await MessageOutbox.findOne({ template: 'security.phone_changed' }).lean();
  assert.equal(alert.to, 'seller9@test.apexora');
  assert.equal(alert.channel, 'email');

  await User.updateOne({ email: 'seller9@test.apexora' }, { $set: { otpLastSentAt: null } });
  await request(app).post('/api/auth/login').send({ email: 'seller9@test.apexora', password: 'TestPass123!' }).expect(200);
  assert.equal(lastSent().channel, 'sms');
  assert.equal(lastSent().to, '+94771112233');

  const cleared = await auth(request(app).patch('/api/auth/me/phone')).send({ phone: '', password: 'TestPass123!' });
  assert.equal(cleared.body.phone, '');
});

test('in production the console provider refuses to send instead of logging codes', async () => {
  const original = process.env.NODE_ENV;
  const log = console.log;
  const printed = [];
  console.log = (...a) => printed.push(a.join(' '));
  try {
    process.env.NODE_ENV = 'production';
    await User.updateOne({ email: 'owner9@test.apexora' }, { $set: { otpLastSentAt: null, otpSendCount: 0 } });
    const res = await request(app).post('/api/auth/login').send({ email: 'owner9@test.apexora', password: 'TestPass123!' });
    assert.equal(res.status, 502);
    assert.ok(!printed.some((l) => /login code is \d{6}/.test(l)), 'no OTP printed to the log');
  } finally {
    process.env.NODE_ENV = original;
    console.log = log;
  }
});
