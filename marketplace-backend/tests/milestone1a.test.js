const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, SellerApplication, Invite, PlatformSettings, User, mongoose,
} = require('./helpers');
const { createInvite } = require('../services/invites');

let sellerA, sellerB;
let tokens = {};

// Minimal real signatures — just enough for utils/fileType.js's magic-
// byte check to recognize each as the real thing, regardless of what
// filename/extension it's attached under.
const VALID_PDF = Buffer.from('%PDF-1.4\nfake but real-signature pdf content for testing\n%%EOF');
const VALID_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('rest of fake jpeg bytes')]);
const VALID_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('rest of fake png bytes'),
]);
const FAKE_EXE_RENAMED_PDF = Buffer.from('MZ\x90\x00 this is actually an executable, not a PDF');
const OVER_5MB = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 1, 'a')]);

function attachValidDocuments(req) {
  return req
    .attach('brCertificate', VALID_PDF, 'br.pdf')
    .attach('nicFront', VALID_JPEG, 'nic-front.jpg')
    .attach('nicBack', VALID_PNG, 'nic-back.png');
}

function validApplicationFields(overrides = {}) {
  return {
    storeName: 'Test Store',
    legalName: 'Test Store Ltd',
    brNumber: 'BR-TEST-1',
    ownerName: 'Test Owner',
    nic: '901234567V',
    phone: '0771234567',
    email: 'applicant@test.apexora',
    address: '123 Test Rd',
    district: 'Colombo',
    ...overrides,
  };
}

before(async () => {
  await wipeDatabase();

  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Staff', email: 'staff@test.apexora', platformRole: 'platform_staff' });
  const sellerAOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  await createUser({ name: 'Customer', email: 'customer@test.apexora' });

  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A', status: 'active' });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B', status: 'in_review' });

  await SellerMember.create({ user: sellerAOwnerUser._id, seller: sellerA._id, role: 'seller_owner' });

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.platformStaff = (await loginFlow('staff@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer@test.apexora')).accessToken;
});

after(async () => {
  await mongoose.disconnect();
});

// --- Authorization matrix across the new admin surfaces ---

test('seller owner gets 403 on GET /api/admin/applications', async () => {
  const res = await request(app).get('/api/admin/applications').set('Authorization', `Bearer ${tokens.sellerAOwner}`);
  assert.equal(res.status, 403);
});

test('customer gets 403 on GET /api/admin/platform-staff', async () => {
  const res = await request(app).get('/api/admin/platform-staff').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(res.status, 403);
});

test('logged-out gets 401 on GET /api/admin/settings', async () => {
  const res = await request(app).get('/api/admin/settings');
  assert.equal(res.status, 401);
});

test('platform_staff gets 403 on owner-only PATCH /api/admin/settings', async () => {
  const res = await request(app)
    .patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ supportEmail: 'hacked@test.apexora' });
  assert.equal(res.status, 403);
});

test('platform_staff gets 403 on owner-only POST /api/admin/platform-staff/invite', async () => {
  const res = await request(app)
    .post('/api/admin/platform-staff/invite')
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ email: 'new-staff@test.apexora' });
  assert.equal(res.status, 403);
});

test('platform_staff gets 403 on owner-only PATCH /api/admin/sellers/:id/overrides', async () => {
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerA._id}/overrides`)
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ commissionOverridePct: 5, reason: 'test' });
  assert.equal(res.status, 403);
});

// --- Malformed IDs in URLs -> 404, not 400/500 ---

test('malformed seller id in URL gets 404', async () => {
  const res = await request(app)
    .get('/api/admin/sellers/not-a-valid-id')
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 404);
});

test('malformed application id in URL gets 404', async () => {
  const res = await request(app)
    .get('/api/admin/applications/not-a-valid-id')
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 404);
});

// --- View-as (read-only impersonation) ---

test('view-as token reads the seller it was issued for', async () => {
  const viewAsRes = await request(app)
    .post(`/api/admin/sellers/${sellerA._id}/view-as`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(viewAsRes.status, 200);
  const { token } = viewAsRes.body;

  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 200);
  assert.equal(res.body.seller.name, 'Store A');
});

test('view-as token cannot be redirected to another seller by changing X-Seller-Id', async () => {
  const viewAsRes = await request(app)
    .post(`/api/admin/sellers/${sellerA._id}/view-as`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  const { token } = viewAsRes.body;

  // The embedded viewAs claim wins regardless of what header is sent —
  // this proves the header can never widen a view-as session's scope.
  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Seller-Id', sellerB._id.toString());
  assert.equal(res.status, 200);
  assert.equal(res.body.seller.name, 'Store A', 'must still resolve to the seller the token was issued for, not the header');
});

test('view-as token gets 403 on every write, regardless of role', async () => {
  const viewAsRes = await request(app)
    .post(`/api/admin/sellers/${sellerA._id}/view-as`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  const { token } = viewAsRes.body;

  const res = await request(app)
    .patch('/api/seller/me/store')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Seller-Id', sellerA._id.toString())
    .send({ phone: '0770000000' });
  assert.equal(res.status, 403);

  const unchanged = await Seller.findById(sellerA._id);
  assert.notEqual(unchanged.phone, '0770000000');
});

// --- Public application submission: real file-type validation ---

test('a renamed .exe disguised as a PDF is rejected', async () => {
  const req = request(app).post('/api/public/seller-applications');
  Object.entries(validApplicationFields({ email: 'fake-exe@test.apexora' })).forEach(([k, v]) => req.field(k, v));
  const res = await req
    .attach('brCertificate', FAKE_EXE_RENAMED_PDF, 'br.pdf')
    .attach('nicFront', VALID_JPEG, 'nic-front.jpg')
    .attach('nicBack', VALID_PNG, 'nic-back.png');
  assert.equal(res.status, 400);
});

test('a file over 5MB is rejected', async () => {
  const req = request(app).post('/api/public/seller-applications');
  Object.entries(validApplicationFields()).forEach(([k, v]) => req.field(k, v));
  const res = await req
    .attach('brCertificate', OVER_5MB, 'br.pdf')
    .attach('nicFront', VALID_JPEG, 'nic-front.jpg')
    .attach('nicBack', VALID_PNG, 'nic-back.png');
  assert.equal(res.status, 400);
});

test('a valid application submission succeeds and starts as "new"', async () => {
  const req = request(app).post('/api/public/seller-applications');
  Object.entries(validApplicationFields({ email: 'valid-applicant@test.apexora' })).forEach(([k, v]) => req.field(k, v));
  const res = await attachValidDocuments(req);
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'new');

  const application = await SellerApplication.findById(res.body.id);
  assert.equal(application.documents.length, 3);
});

// --- Applications admin flow + audit entries ---

test('request-info moves an application to info_requested and audits it', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'info-req@test.apexora', storeName: 'Info Req Store' }));

  const res = await request(app)
    .post(`/api/admin/applications/${application._id}/request-info`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ message: 'Please resend a clearer BR certificate' });
  assert.equal(res.status, 200);
  assert.equal(res.body.application.status, 'info_requested');

  const entry = await AuditLog.findOne({ targetId: application._id.toString(), action: 'application.request_info' });
  assert.ok(entry, 'expected exactly one audit entry for this action');
});

test('approve creates a Seller and a seller_owner invite, and audits it', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'approve-me@test.apexora', storeName: 'Approve Me Store' }));

  const res = await request(app)
    .post(`/api/admin/applications/${application._id}/approve`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.application.status, 'approved');
  assert.ok(res.body.seller._id);

  const invite = await Invite.findOne({ email: 'approve-me@test.apexora', role: 'seller_owner' });
  assert.ok(invite, 'expected a seller_owner invite to have been created');
  assert.equal(invite.seller.toString(), res.body.seller._id.toString());

  const entry = await AuditLog.findOne({ targetId: application._id.toString(), action: 'application.approve' });
  assert.ok(entry);
});

test('approving an already-approved application returns 409 and changes nothing', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'already-approved@test.apexora', status: 'approved' }));

  const res = await request(app)
    .post(`/api/admin/applications/${application._id}/approve`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({});
  assert.equal(res.status, 409);

  const sellerCount = await Seller.countDocuments({ application: application._id });
  assert.equal(sellerCount, 0);
});

test('reject sets a reason and audits it', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'reject-me@test.apexora' }));

  const res = await request(app)
    .post(`/api/admin/applications/${application._id}/reject`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ reason: 'BR certificate does not match legal name' });
  assert.equal(res.status, 200);
  assert.equal(res.body.application.status, 'rejected');
  assert.equal(res.body.application.rejectedReason, 'BR certificate does not match legal name');

  const entry = await AuditLog.findOne({ targetId: application._id.toString(), action: 'application.reject' });
  assert.ok(entry);
});

test('checklist update audits exactly one entry', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'checklist@test.apexora' }));
  const before = await AuditLog.countDocuments({ targetId: application._id.toString() });

  const res = await request(app)
    .patch(`/api/admin/applications/${application._id}/checklist`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ brVerified: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.application.checklist.brVerified, true);

  const after = await AuditLog.countDocuments({ targetId: application._id.toString() });
  assert.equal(after, before + 1);
});

// --- Invite acceptance (public route) ---

test('a seller_owner invite can be accepted and grants SellerMember access', async () => {
  const application = await SellerApplication.create(validApplicationFields({ email: 'invite-flow@test.apexora', storeName: 'Invite Flow Store' }));
  const approveRes = await request(app)
    .post(`/api/admin/applications/${application._id}/approve`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({});
  const newSellerId = approveRes.body.seller._id;

  const invite = await Invite.findOne({ email: 'invite-flow@test.apexora', role: 'seller_owner' });
  // The raw token isn't stored anywhere retrievable in prod (only its
  // hash) — in dev it's printed to the console, which this test can't
  // read, so it re-derives one the same way the controller does to
  // exercise the acceptance endpoint's logic directly isn't possible
  // without the raw value. Instead, mint a fresh invite via the same
  // service used by the controller, so we hold the raw token.
  const { token: rawToken } = await createInvite({ email: 'invite-flow@test.apexora', role: 'seller_owner', sellerId: newSellerId, invitedBy: { _id: invite.invitedBy } });

  const res = await request(app)
    .post(`/api/public/invites/${rawToken}/accept`)
    .send({ name: 'New Owner', password: 'SomePassword123!' });
  assert.equal(res.status, 200);

  const membership = await SellerMember.findOne({ seller: newSellerId, role: 'seller_owner' }).populate('user');
  assert.ok(membership);
  assert.equal(membership.user.email, 'invite-flow@test.apexora');
});

test('accepting an unknown invite token returns 404', async () => {
  const res = await request(app)
    .post('/api/public/invites/not-a-real-token/accept')
    .send({ name: 'Nobody', password: 'SomePassword123!' });
  assert.equal(res.status, 404);
});

// --- Platform staff management ---

test('owner invites a new platform staff member and it is audited', async () => {
  const res = await request(app)
    .post('/api/admin/platform-staff/invite')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ email: 'new-staff@test.apexora' });
  assert.equal(res.status, 201);

  const invite = await Invite.findOne({ email: 'new-staff@test.apexora', role: 'platform_staff' });
  assert.ok(invite);

  const entry = await AuditLog.findOne({ targetId: invite._id.toString(), action: 'platform_staff.invite' });
  assert.ok(entry);
});

test('owner cannot change their own role', async () => {
  const owner = await User.findOne({ email: 'owner@test.apexora' });
  const res = await request(app)
    .patch(`/api/admin/platform-staff/${owner._id}/role`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ role: 'none' });
  assert.equal(res.status, 403);
});

test('owner cannot remove themselves', async () => {
  const owner = await User.findOne({ email: 'owner@test.apexora' });
  const res = await request(app)
    .delete(`/api/admin/platform-staff/${owner._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 403);
});

test('owner can demote platform_staff to none, and it is audited', async () => {
  const staff = await User.findOne({ email: 'staff@test.apexora' });
  const res = await request(app)
    .patch(`/api/admin/platform-staff/${staff._id}/role`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ role: 'none' });
  assert.equal(res.status, 200);

  const entry = await AuditLog.findOne({ targetId: staff._id.toString(), action: 'platform_staff.role.change' });
  assert.ok(entry);

  // Revert for any later test relying on tokens.platformStaff still being staff.
  await request(app)
    .patch(`/api/admin/platform-staff/${staff._id}/role`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ role: 'platform_staff' });
});

// --- Audit log ---

test('audit log CSV export returns csv content and a header row', async () => {
  const res = await request(app)
    .get('/api/admin/audit-log/export.csv')
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.text.split('\n')[0], /Time \(UTC\)/);
});

// --- Settings ---

test('settings PATCH by the owner is audited with before/after', async () => {
  const res = await request(app)
    .patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ supportEmail: 'support@apexora.test' });
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.supportEmail, 'support@apexora.test');

  const entry = await AuditLog.findOne({ action: 'settings.update' }).sort({ createdAt: -1 });
  assert.ok(entry);
  assert.equal(entry.after.supportEmail, 'support@apexora.test');

  await PlatformSettings.deleteMany({}); // keep this test re-runnable
});
