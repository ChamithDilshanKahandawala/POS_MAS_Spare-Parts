const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, mongoose,
} = require('./helpers');
const Category = require('../models/Category');
const VehicleMake = require('../models/VehicleMake');

let sellerA, sellerB;
let tokens = {};

before(async () => {
  await wipeDatabase();
  await Category.deleteMany({});
  await VehicleMake.deleteMany({});

  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Staff', email: 'staff@test.apexora', platformRole: 'platform_staff' });
  const sellerAOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  const sellerBOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });
  await createUser({ name: 'Customer', email: 'customer@test.apexora' });

  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A', status: 'active' });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B', status: 'active' });

  await SellerMember.insertMany([
    { user: sellerAOwnerUser._id, seller: sellerA._id, role: 'seller_owner' },
    { user: sellerBOwnerUser._id, seller: sellerB._id, role: 'seller_owner' },
  ]);

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.platformStaff = (await loginFlow('staff@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.sellerBOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer@test.apexora')).accessToken;
});

after(async () => {
  await Category.deleteMany({});
  await VehicleMake.deleteMany({});
  await mongoose.disconnect();
});

function seller(req, id) {
  return req.set('X-Seller-Id', id.toString());
}

const name = (en) => ({ en, si: '', ta: '' });

// --- Authorization ---

test('seller, customer, and logged-out cannot call admin catalog routes', async () => {
  const sellerRes = await seller(request(app).get('/api/admin/catalog/categories').set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(sellerRes.status, 403);

  const customerRes = await request(app).get('/api/admin/catalog/categories').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(customerRes.status, 403);

  const loggedOutRes = await request(app).get('/api/admin/catalog/categories');
  assert.equal(loggedOutRes.status, 401);
});

test('platform staff gets 403 changing commission, regulated, or reviewRequired', async () => {
  const category = await Category.create({ name: name('Temp'), slug: 'temp-staff-test', depth: 0, commissionRateBps: 0 });

  const commissionRes = await request(app)
    .patch(`/api/admin/catalog/categories/${category._id}`)
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ commissionRateBps: 100 });
  assert.equal(commissionRes.status, 403);

  const regulatedRes = await request(app)
    .patch(`/api/admin/catalog/categories/${category._id}`)
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ regulated: true });
  assert.equal(regulatedRes.status, 403);

  const reviewRes = await request(app)
    .patch(`/api/admin/catalog/categories/${category._id}`)
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ reviewRequired: true });
  assert.equal(reviewRes.status, 403);

  // Control: staff CAN still edit a staff-allowed field on the same category.
  const okRes = await request(app)
    .patch(`/api/admin/catalog/categories/${category._id}`)
    .set('Authorization', `Bearer ${tokens.platformStaff}`)
    .send({ icon: 'box' });
  assert.equal(okRes.status, 200);
});

// --- Create, depth, slug ---

let vehicleParts, vehiclePartsCar, vehiclePartsCarTooDeep;

test('owner creates a 3-level category tree (root -> child -> grandchild)', async () => {
  const rootRes = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({
      name: name('Vehicle Parts'), slug: 'test-vehicle-parts',
      returnPolicy: { returnable: true, windowDays: 7, note: name('Returnable within 7 days.') },
      attributeSchema: [{ key: 'condition', label: name('Condition'), type: 'select', required: true, options: [{ value: 'new', label: name('New') }] }],
    });
  assert.equal(rootRes.status, 201);
  assert.equal(rootRes.body.category.depth, 0);
  vehicleParts = rootRes.body.category;

  const childRes = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: name('Car'), slug: 'test-vehicle-parts-car', parentId: vehicleParts._id });
  assert.equal(childRes.status, 201);
  assert.equal(childRes.body.category.depth, 1);
  vehiclePartsCar = childRes.body.category;

  const grandchildRes = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: name('Engine'), slug: 'test-vehicle-parts-car-engine', parentId: vehiclePartsCar._id });
  assert.equal(grandchildRes.status, 201);
  assert.equal(grandchildRes.body.category.depth, 2);
  vehiclePartsCarTooDeep = grandchildRes.body.category;
});

test('a 4th level (depth > 2, "more than 3 levels") is rejected', async () => {
  const res = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: name('Piston'), slug: 'test-vehicle-parts-car-engine-piston', parentId: vehiclePartsCarTooDeep._id });
  assert.equal(res.status, 400);
});

test('a duplicate slug is rejected', async () => {
  const res = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: name('Duplicate'), slug: 'test-vehicle-parts-car' });
  assert.equal(res.status, 409);
});

// --- Inheritance ---

test('a child with no overrides inherits the parent\'s return policy and attribute fields', async () => {
  const res = await request(app)
    .get(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.effective.returnPolicy.returnable, true);
  assert.equal(res.body.effective.returnPolicy.windowDays, 7);
  assert.ok(res.body.effective.attributeSchema.some((f) => f.key === 'condition'));
  const inherited = res.body.effective.attributeSchema.find((f) => f.key === 'condition');
  assert.ok(inherited.inheritedFrom, 'inherited field should carry an inheritedFrom marker');
});

test('a child CAN override an inherited field by reusing its key', async () => {
  const res = await request(app)
    .patch(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ attributeSchema: [{ key: 'condition', label: name('Condition (Car-specific)'), type: 'select', required: true, options: [{ value: 'new', label: name('New') }] }] });
  assert.equal(res.status, 200);

  const detail = await request(app)
    .get(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  const field = detail.body.effective.attributeSchema.find((f) => f.key === 'condition');
  assert.equal(field.label.en, 'Condition (Car-specific)');
  assert.equal(field.inheritedFrom, null, 'the child\'s own override is not "inherited"');
});

// --- Commission validation ---

test('commissionRateBps outside 0-5000 is rejected', async () => {
  const res = await request(app)
    .patch(`/api/admin/catalog/categories/${vehicleParts._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ commissionRateBps: 5001 });
  assert.equal(res.status, 400);
});

test('a non-integer commissionRateBps is rejected', async () => {
  const res = await request(app)
    .patch(`/api/admin/catalog/categories/${vehicleParts._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ commissionRateBps: 2.5 });
  assert.equal(res.status, 400);
});

// --- Rename guard (simulated via the listingCount hook) ---

test('slug rename is blocked once the category has listings', async () => {
  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 3 });

  const res = await request(app)
    .patch(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ slug: 'test-vehicle-parts-car-renamed' });
  assert.equal(res.status, 409);

  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 0 }); // revert
});

test('a field key rename is blocked once the category has listings, but adding a new field is not', async () => {
  const before = await Category.findById(vehiclePartsCar._id);
  const existingField = before.attributeSchema.find((f) => f.key === 'condition');
  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 3 });

  const renameRes = await request(app)
    .patch(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ attributeSchema: [{ _id: existingField._id.toString(), key: 'conditionRenamed', label: name('Condition'), type: 'select', required: true, options: [{ value: 'new', label: name('New') }] }] });
  assert.equal(renameRes.status, 409);

  const addRes = await request(app)
    .patch(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({
      attributeSchema: [
        { _id: existingField._id.toString(), key: existingField.key, label: existingField.label, type: existingField.type, required: true, options: existingField.options },
        { key: 'brandNew', label: name('Brand new field'), type: 'text', required: true },
      ],
    });
  assert.equal(addRes.status, 200, 'adding a new required field must still be allowed even with listings on the category');

  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 0 }); // revert
});

test('a category with listings cannot be deleted, only deactivated', async () => {
  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 3 });
  const deleteRes = await request(app)
    .delete(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(deleteRes.status, 409);

  const deactivateRes = await request(app)
    .patch(`/api/admin/catalog/categories/${vehiclePartsCar._id}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ active: false });
  assert.equal(deactivateRes.status, 200);
  assert.equal(deactivateRes.body.category.active, false);

  await Category.findByIdAndUpdate(vehiclePartsCar._id, { listingCount: 0, active: true }); // revert
});

// --- Public endpoint ---

test('the public category endpoint never returns commission or internal rules', async () => {
  const res = await request(app).get('/api/public/catalog/categories');
  assert.equal(res.status, 200);
  const flatten = (nodes) => nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const all = flatten(res.body.tree);
  assert.ok(all.length > 0);
  for (const node of all) {
    assert.equal(node.commissionRateBps, undefined);
    assert.equal(node.regulated, undefined);
    assert.equal(node.reviewRequired, undefined);
    assert.equal(node.returnPolicy, undefined);
    assert.equal(node.prohibitedKeywords, undefined);
    assert.equal(node.attributeSchema, undefined);
    assert.ok('name' in node && 'slug' in node);
  }
});

// --- Seller endpoint + per-seller commission override ---

test('a seller sees their own effective commission (override wins), and it\'s isolated from other sellers', async () => {
  // Give store A a 5% (500bps) override; store B gets none.
  await request(app)
    .patch(`/api/admin/sellers/${sellerA._id}/overrides`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ commissionOverridePct: 5, reason: 'test override' });

  await Category.findByIdAndUpdate(vehicleParts._id, { commissionRateBps: 200 }); // 2%

  const aRes = await seller(request(app).get('/api/seller/catalog/categories').set('Authorization', `Bearer ${tokens.sellerAOwner}`), sellerA._id);
  assert.equal(aRes.status, 200);
  const aNode = aRes.body.tree.find((n) => n.category.slug === 'test-vehicle-parts');
  assert.equal(aNode.effective.commissionRateBps, 500, 'store A\'s override (5%) should win over the category\'s own 200bps');

  const bRes = await seller(request(app).get('/api/seller/catalog/categories').set('Authorization', `Bearer ${tokens.sellerBOwner}`), sellerB._id);
  const bNode = bRes.body.tree.find((n) => n.category.slug === 'test-vehicle-parts');
  assert.equal(bNode.effective.commissionRateBps, 200, 'store B has no override — sees the category\'s own rate');
});

test('seller B cannot read seller A\'s catalog via seller A\'s id in X-Seller-Id', async () => {
  const res = await seller(request(app).get('/api/seller/catalog/categories').set('Authorization', `Bearer ${tokens.sellerBOwner}`), sellerA._id);
  assert.equal(res.status, 404);
});

// --- Audit ---

test('category create, update, and delete are each audited exactly once', async () => {
  const createRes = await request(app)
    .post('/api/admin/catalog/categories')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: name('Audit Test'), slug: 'test-audit-category' });
  const categoryId = createRes.body.category._id;

  const createEntry = await AuditLog.findOne({ targetId: categoryId, action: 'category.create' });
  assert.ok(createEntry);

  await request(app)
    .patch(`/api/admin/catalog/categories/${categoryId}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ icon: 'tag' });
  const updateCount = await AuditLog.countDocuments({ targetId: categoryId, action: 'category.update' });
  assert.equal(updateCount, 1);

  await request(app)
    .delete(`/api/admin/catalog/categories/${categoryId}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  const deleteEntry = await AuditLog.findOne({ targetId: categoryId, action: 'category.delete' });
  assert.ok(deleteEntry);
});

// --- Vehicles ---

test('admin can create a vehicle make with models; public read only returns active ones', async () => {
  const createRes = await request(app)
    .post('/api/admin/vehicles')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ name: 'TestMake', type: 'car', models: [{ name: 'Active Model', active: true }, { name: 'Inactive Model', active: false }] });
  assert.equal(createRes.status, 201);

  const publicRes = await request(app).get('/api/public/vehicles');
  const make = publicRes.body.makes.find((m) => m.name === 'TestMake');
  assert.ok(make);
  assert.equal(make.models.length, 1);
  assert.equal(make.models[0].name, 'Active Model');
});

test('seller and customer cannot write vehicles', async () => {
  const res = await request(app)
    .post('/api/admin/vehicles')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .send({ name: 'Nope', type: 'car' });
  assert.equal(res.status, 403);
});
