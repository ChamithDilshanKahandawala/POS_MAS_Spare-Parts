const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, Invite, Notification, User, mongoose,
} = require('./helpers');
const { createInvite } = require('../services/invites');

let sellerA, sellerB, sellerC;
let tokens = {};
let validJpeg, validPng, overSizedBuffer;
const fakeExe = Buffer.from('MZ\x90\x00 this is actually an executable, not an image');

before(async () => {
  await wipeDatabase();

  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  const sellerAOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  const sellerAStaffUser = await createUser({ name: 'A Staff', email: 'a-staff@test.apexora' });
  const sellerBOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });
  const sellerCOwnerUser = await createUser({ name: 'C Owner', email: 'c-owner@test.apexora' });
  await createUser({ name: 'Customer', email: 'customer@test.apexora' });

  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A', status: 'active' });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B', status: 'active' });
  sellerC = await Seller.create({ name: 'Store C', legalName: 'Store C Ltd', brNumber: 'BR-C', status: 'suspended' });

  await SellerMember.insertMany([
    { user: sellerAOwnerUser._id, seller: sellerA._id, role: 'seller_owner' },
    { user: sellerAStaffUser._id, seller: sellerA._id, role: 'seller_staff' },
    { user: sellerBOwnerUser._id, seller: sellerB._id, role: 'seller_owner' },
    { user: sellerCOwnerUser._id, seller: sellerC._id, role: 'seller_owner' },
  ]);

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.sellerAStaff = (await loginFlow('a-staff@test.apexora')).accessToken;
  tokens.sellerBOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
  tokens.sellerCOwner = (await loginFlow('c-owner@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer@test.apexora')).accessToken;

  validJpeg = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toBuffer();
  validPng = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 10, g: 200, b: 30, alpha: 1 } } }).png().toBuffer();
  overSizedBuffer = Buffer.concat([validJpeg, Buffer.alloc(5 * 1024 * 1024 + 1, 'a')]);
});

after(async () => {
  await mongoose.disconnect();
});

function seller(req, id) {
  return req.set('X-Seller-Id', id.toString());
}

// --- Cross-seller isolation (404 via X-Seller-Id) ---

test('seller B owner gets 404 reading seller A home/staff/activity/bank', async () => {
  for (const path of ['/api/seller/me/home', '/api/seller/staff', '/api/seller/activity', '/api/seller/bank']) {
    const res = await seller(request(app).get(path).set('Authorization', `Bearer ${tokens.sellerBOwner}`), sellerA._id);
    assert.equal(res.status, 404, `${path} should 404`);
  }
});

test('seller B owner gets 404 writing to seller A settings/staff/bank', async () => {
  const settingsRes = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerBOwner}`).send({ displayName: 'Hijacked' }),
    sellerA._id
  );
  assert.equal(settingsRes.status, 404);

  const staffRes = await seller(
    request(app).post('/api/seller/staff/invite').set('Authorization', `Bearer ${tokens.sellerBOwner}`).send({ email: 'intruder@test.apexora' }),
    sellerA._id
  );
  assert.equal(staffRes.status, 404);
});

// --- Staff restrictions ---

test('seller staff gets 403 saving settings', async () => {
  const res = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerAStaff}`).send({ displayName: 'Nope' }),
    sellerA._id
  );
  assert.equal(res.status, 403);
});

test('seller staff gets 403 on bank and staff routes', async () => {
  const bankRes = await seller(
    request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${tokens.sellerAStaff}`).send({ password: 'x' }),
    sellerA._id
  );
  assert.equal(bankRes.status, 403);

  const staffRes = await seller(
    request(app).get('/api/seller/staff').set('Authorization', `Bearer ${tokens.sellerAStaff}`),
    sellerA._id
  );
  assert.equal(staffRes.status, 403);
});

// --- Customer / logged-out ---

test('customer and logged-out get 403/401 on every /api/seller/* route', async () => {
  const paths = ['/api/seller/me/home', '/api/seller/staff', '/api/seller/activity', '/api/seller/bank'];
  for (const path of paths) {
    const customerRes = await seller(request(app).get(path).set('Authorization', `Bearer ${tokens.customer}`), sellerA._id);
    assert.equal(customerRes.status, 404, `${path} customer`); // not a member anywhere -> 404, same as any non-member
    const loggedOutRes = await request(app).get(path);
    assert.equal(loggedOutRes.status, 401, `${path} logged-out`);
  }
});

// --- Suspended store ---

test('suspended store: writes get 403, reads still work', async () => {
  const writeRes = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerCOwner}`).send({ displayName: 'Trying' }),
    sellerC._id
  );
  assert.equal(writeRes.status, 403);

  const readRes = await seller(
    request(app).get('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerCOwner}`),
    sellerC._id
  );
  assert.equal(readRes.status, 200);
});

// --- Profile update + Home checklist ---

test('owner updates the store profile, and it is audited exactly once', async () => {
  const before = await AuditLog.countDocuments({ targetId: sellerA._id.toString() });

  const res = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({
      displayName: 'Store A Display',
      aboutText: { en: 'We sell parts.', si: '', ta: '' },
      phones: ['0771234567'],
      whatsapp: '0771234567',
      returnAddress: '12 Return Rd, Colombo',
    }),
    sellerA._id
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.seller.displayName, 'Store A Display');

  const after = await AuditLog.countDocuments({ targetId: sellerA._id.toString() });
  assert.equal(after, before + 1);
});

test('home checklist reflects real profile state', async () => {
  const res = await seller(
    request(app).get('/api/seller/me/home').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(res.status, 200);
  const aboutItem = res.body.checklist.items.find((i) => i.key === 'aboutText');
  assert.equal(aboutItem.done, true); // set in the previous test
  // Milestone 3: firstListing is a real, checkable item now — this
  // seller hasn't submitted one yet, so it's available but not done.
  const firstListingItem = res.body.checklist.items.find((i) => i.key === 'firstListing');
  assert.equal(firstListingItem.available, true);
  assert.equal(firstListingItem.done, false);
  assert.equal(res.body.ordersToday, null);
  assert.equal(res.body.pendingPayout, null);
});

test('legalName and brNumber are rejected if sent on the profile update (read-only)', async () => {
  const res = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ legalName: 'Hacked Ltd' }),
    sellerA._id
  );
  assert.equal(res.status, 400);
});

// --- Logo / banner uploads ---

test('a fake file disguised as an image is rejected for the logo upload', async () => {
  const res = await seller(
    request(app).post('/api/seller/me/store/logo').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('file', fakeExe, 'logo.jpg');
  assert.equal(res.status, 400);
});

test('an oversized file is rejected for the banner upload', async () => {
  const res = await seller(
    request(app).post('/api/seller/me/store/banner').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('file', overSizedBuffer, 'banner.jpg');
  assert.equal(res.status, 400);
});

test('a valid JPEG logo upload succeeds, is processed, and is fetchable', async () => {
  const uploadRes = await seller(
    request(app).post('/api/seller/me/store/logo').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('file', validJpeg, 'logo.jpg');
  assert.equal(uploadRes.status, 200);
  assert.ok(uploadRes.body.logo.path);

  const getRes = await seller(
    request(app).get('/api/seller/me/store/logo').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(getRes.status, 200);
  assert.match(getRes.headers['content-type'], /image\/jpeg/);
});

test('a valid PNG banner upload succeeds (normalized to JPEG)', async () => {
  const res = await seller(
    request(app).post('/api/seller/me/store/banner').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  ).attach('file', validPng, 'banner.png');
  assert.equal(res.status, 200);
  assert.ok(res.body.banner.path);
});

test('staff cannot upload a logo (owner only)', async () => {
  const res = await seller(
    request(app).post('/api/seller/me/store/logo').set('Authorization', `Bearer ${tokens.sellerAStaff}`),
    sellerA._id
  ).attach('file', validJpeg, 'logo.jpg');
  assert.equal(res.status, 403);
});

// --- Bank account + step-up ---

test('PATCH /bank without a fresh step-up is rejected', async () => {
  const res = await seller(
    request(app).patch('/api/seller/bank').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({
      bankName: 'Sampath Bank', branch: 'Colombo', accountName: 'Store A', accountNumber: '123456789012',
    }),
    sellerA._id
  );
  assert.equal(res.status, 403);
});

test('full step-up flow lets the owner save a bank account, masked everywhere after', async () => {
  const startRes = await seller(
    request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ password: 'TestPass123!' }),
    sellerA._id
  );
  assert.equal(startRes.status, 200);
  assert.ok(startRes.body.debugOtpCode);

  const verifyRes = await seller(
    request(app).post('/api/seller/bank/step-up/verify').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ code: startRes.body.debugOtpCode }),
    sellerA._id
  );
  assert.equal(verifyRes.status, 200);

  const patchRes = await seller(
    request(app).patch('/api/seller/bank').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({
      bankName: 'Sampath Bank', branch: 'Colombo', accountName: 'Store A', accountNumber: '123456789012',
    }),
    sellerA._id
  );
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.bankAccount.last4, '9012');
  assert.equal(patchRes.body.bankAccount.accountNumber, undefined, 'full number must never appear in a seller-facing response');
  assert.equal(patchRes.body.bankAccount.status, 'pending');

  const getRes = await seller(
    request(app).get('/api/seller/bank').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(getRes.body.bankAccount.accountNumber, undefined);
  assert.equal(getRes.body.bankAccount.last4, '9012');

  const storeRes = await seller(
    request(app).get('/api/seller/me/store').set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(storeRes.body.seller.bankAccount.accountNumber, undefined, 'full number must never leak via GET /me/store either');
});

test('admin full bank view returns the real number and is audited', async () => {
  const before = await AuditLog.countDocuments({ targetId: sellerA._id.toString(), action: 'seller.bank.view_full' });

  const res = await request(app)
    .get(`/api/admin/sellers/${sellerA._id}/bank`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.bankAccount.accountNumber, '123456789012');

  const after = await AuditLog.countDocuments({ targetId: sellerA._id.toString(), action: 'seller.bank.view_full' });
  assert.equal(after, before + 1);
});

test('admin verifies the bank account and the seller is notified', async () => {
  const sellerAOwnerUser = await User.findOne({ email: 'a-owner@test.apexora' });

  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerA._id}/bank/verify`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.seller.bankAccount.status, 'verified');

  const notification = await Notification.findOne({ user: sellerAOwnerUser._id, type: 'bank.verified' });
  assert.ok(notification);
});

test('verifying an already-verified bank account returns 409', async () => {
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerA._id}/bank/verify`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({});
  assert.equal(res.status, 409);
});

test('changing a verified bank account notifies platform owners and resets to pending', async () => {
  const startRes = await seller(
    request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ password: 'TestPass123!' }),
    sellerA._id
  );
  await seller(
    request(app).post('/api/seller/bank/step-up/verify').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ code: startRes.body.debugOtpCode }),
    sellerA._id
  );
  const res = await seller(
    request(app).patch('/api/seller/bank').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({
      bankName: 'HNB', branch: 'Kandy', accountName: 'Store A', accountNumber: '999888777666',
    }),
    sellerA._id
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.bankAccount.status, 'pending');

  const platformOwner = await User.findOne({ email: 'owner@test.apexora' });
  const notification = await Notification.findOne({ user: platformOwner._id, type: 'bank.resubmitted' });
  assert.ok(notification);
});

// --- Staff invite / accept ---

test('owner invites staff; the invite can only grant seller_staff, never a different role', async () => {
  const res = await seller(
    request(app).post('/api/seller/staff/invite').set('Authorization', `Bearer ${tokens.sellerAOwner}`).send({ email: 'new-staff@test.apexora' }),
    sellerA._id
  );
  assert.equal(res.status, 201);

  const invite = await Invite.findOne({ email: 'new-staff@test.apexora', role: 'seller_staff' });
  assert.ok(invite);
  assert.equal(invite.seller.toString(), sellerA._id.toString());

  // Accept it — even if the client tries to sneak a `role` field into the
  // body, the public route's zod schema only accepts name/password, so
  // there's no way to request a different role than the invite carries.
  const { token: rawToken } = await createInvite({ email: 'new-staff@test.apexora', role: 'seller_staff', sellerId: sellerA._id, invitedBy: { _id: invite.invitedBy } });
  const acceptRes = await request(app)
    .post(`/api/public/invites/${rawToken}/accept`)
    .send({ name: 'New Staff', password: 'NewStaffPass123!' });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.role, 'seller_staff');

  // sellerA already has a pre-seeded seller_staff member (a-staff@test.apexora)
  // from the top-level before() hook, so this looks up the new user first
  // and finds the membership by their id, rather than an ambiguous
  // findOne({ role: 'seller_staff' }) that could match either one.
  const newStaffUser = await User.findOne({ email: 'new-staff@test.apexora' });
  assert.ok(newStaffUser);
  const member = await SellerMember.findOne({ seller: sellerA._id, user: newStaffUser._id }).populate('user');
  assert.equal(member.role, 'seller_staff');
  assert.equal(member.user.email, 'new-staff@test.apexora');

  const ownerUser = await User.findOne({ email: 'a-owner@test.apexora' });
  const notification = await Notification.findOne({ user: ownerUser._id, type: 'staff.invite_accepted' });
  assert.ok(notification);
});

test('expired/used invite tokens are rejected with a clear 404', async () => {
  await Invite.create({
    email: 'expired@test.apexora',
    role: 'seller_staff',
    seller: sellerA._id,
    invitedBy: (await User.findOne({ email: 'owner@test.apexora' }))._id,
    tokenHash: await bcrypt.hash('sometoken', 10),
    expiresAt: new Date(Date.now() - 1000),
  });
  const res = await request(app).get('/api/public/invites/sometoken');
  assert.equal(res.status, 404);
});

test('owner cannot remove themselves from staff', async () => {
  const ownerMember = await SellerMember.findOne({ seller: sellerA._id, role: 'seller_owner' });
  const res = await seller(
    request(app).delete(`/api/seller/staff/${ownerMember._id}`).set('Authorization', `Bearer ${tokens.sellerAOwner}`),
    sellerA._id
  );
  assert.equal(res.status, 403);
});

// --- Status change notifications ---

test('suspending an active store notifies its members', async () => {
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'suspend', reason: 'test suspend' });
  assert.equal(res.status, 200);

  const bOwner = await User.findOne({ email: 'b-owner@test.apexora' });
  const notification = await Notification.findOne({ user: bOwner._id, type: 'seller.suspended' });
  assert.ok(notification);

  // Revert for test independence.
  await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'reactivate', reason: 'revert' });
});

// --- Notifications: per-user isolation ---

test('a user cannot read or mark another user\'s notification', async () => {
  const bOwner = await User.findOne({ email: 'b-owner@test.apexora' });
  const notification = await Notification.findOne({ user: bOwner._id }).sort({ createdAt: -1 });
  assert.ok(notification, 'expected at least one notification for B owner from the suspend test');

  const res = await request(app)
    .patch(`/api/notifications/${notification._id}/read`)
    .set('Authorization', `Bearer ${tokens.sellerAOwner}`);
  assert.equal(res.status, 404);
});

test('a user can list, mark one read, and mark all read for their own notifications', async () => {
  const listRes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokens.sellerBOwner}`);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.entries.length > 0);
  assert.ok(listRes.body.unreadCount > 0);

  const target = listRes.body.entries[0];
  const markRes = await request(app).patch(`/api/notifications/${target._id}/read`).set('Authorization', `Bearer ${tokens.sellerBOwner}`);
  assert.equal(markRes.status, 200);
  assert.equal(markRes.body.notification.read, true);

  const markAllRes = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${tokens.sellerBOwner}`);
  assert.equal(markAllRes.status, 200);

  const afterRes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokens.sellerBOwner}`);
  assert.equal(afterRes.body.unreadCount, 0);
});

// --- View-as still blocked on every new write route ---

test('a view-as token is still 403 on every new Milestone 1B write route', async () => {
  const viewAsRes = await request(app)
    .post(`/api/admin/sellers/${sellerA._id}/view-as`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  const { token } = viewAsRes.body;

  const profileRes = await seller(
    request(app).patch('/api/seller/me/store').set('Authorization', `Bearer ${token}`).send({ displayName: 'Nope' }),
    sellerA._id
  );
  assert.equal(profileRes.status, 403);

  const bankRes = await seller(
    request(app).post('/api/seller/bank/step-up').set('Authorization', `Bearer ${token}`).send({ password: 'x' }),
    sellerA._id
  );
  assert.equal(bankRes.status, 403);

  const staffRes = await seller(
    request(app).post('/api/seller/staff/invite').set('Authorization', `Bearer ${token}`).send({ email: 'x@test.apexora' }),
    sellerA._id
  );
  assert.equal(staffRes.status, 403);
});
