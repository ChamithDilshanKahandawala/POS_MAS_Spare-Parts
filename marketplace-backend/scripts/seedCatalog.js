// Milestone 2's starter catalog — categories + vehicle reference data.
// Both are explicitly STARTER lists (the task's own words): sensible
// enough to build and test against, not a claim that this is the real,
// final taxonomy. Called from seed-dev.js, not run standalone (it
// doesn't wipe/reconnect on its own).
const Category = require('../models/Category');
const VehicleMake = require('../models/VehicleMake');

const lt = (en, si = '', ta = '') => ({ en, si, ta });

// --- Vehicle Parts: the 11 categories storefront/src/config/store.js's
// CATEGORIES already uses today, kept as-is (same English names) so a
// future storefront integration doesn't need a remap. Shared fields
// (fitment/part number/OEM number/condition/position) and the return
// policy live on the PARENT only — every child inherits them, which is
// exactly what services/categoryRules.js's inheritance exists for.
const VEHICLE_PARTS_SUBCATEGORIES = [
  'Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road',
  'KeyTag', 'Toys', 'Ornaments', 'Electronics', 'Company Item', 'ANYVEHICLE',
];

const VEHICLE_PARTS_FIELDS = [
  { key: 'fitment', label: lt('Vehicle fitment'), type: 'fitment', required: true, showOnProductPage: true, filterable: true },
  { key: 'partNumber', label: lt('Part number'), type: 'text', required: false, maxLength: 60, showOnProductPage: true, filterable: false },
  { key: 'oemNumber', label: lt('OEM number'), type: 'text', required: false, maxLength: 60, showOnProductPage: true, filterable: false },
  {
    key: 'condition', label: lt('Condition'), type: 'select', required: true, filterable: true,
    options: [
      { value: 'new', label: lt('New') },
      { value: 'used', label: lt('Used') },
      { value: 'refurbished', label: lt('Refurbished') },
    ],
  },
  {
    key: 'position', label: lt('Position'), type: 'select', required: false, filterable: true,
    options: [
      { value: 'front', label: lt('Front') },
      { value: 'rear', label: lt('Rear') },
      { value: 'left', label: lt('Left') },
      { value: 'right', label: lt('Right') },
      { value: 'universal', label: lt('Universal (fits any position)') },
    ],
  },
];

const APPLIANCE_FIELDS = [
  { key: 'power', label: lt('Power'), type: 'number', unit: 'W', required: false, showOnProductPage: true, filterable: true },
  { key: 'voltage', label: lt('Voltage'), type: 'select', required: false, filterable: true, options: [{ value: '110v', label: lt('110V') }, { value: '220-240v', label: lt('220-240V') }] },
  { key: 'warranty', label: lt('Warranty'), type: 'text', required: false, maxLength: 60, showOnProductPage: true, filterable: false },
];

const BEAUTY_FIELDS = [
  { key: 'nmraRegistrationNumber', label: lt('NMRA registration number'), type: 'text', required: true, maxLength: 60 },
  { key: 'expiryDate', label: lt('Expiry date'), type: 'date', required: true },
  { key: 'volumeWeight', label: lt('Volume / weight'), type: 'text', required: false, maxLength: 40 },
];

async function createCategory({ name, slug, parentId, depth, icon = '', sortOrder = 0, returnPolicy, regulated = null, reviewRequired = null, attributeSchema = [] }) {
  return Category.create({
    name: lt(name),
    slug,
    parentId: parentId || null,
    depth,
    icon,
    sortOrder,
    commissionRateBps: 0, // "All commission 0 bps" per the spec
    returnPolicy,
    regulated,
    reviewRequired,
    attributeSchema,
  });
}

async function seedCategories() {
  await Category.deleteMany({});

  const vehicleParts = await createCategory({
    name: 'Vehicle Parts', slug: 'vehicle-parts', depth: 0, sortOrder: 0,
    icon: 'car',
    returnPolicy: { returnable: true, windowDays: 7, note: lt('Returnable within 7 days of delivery if unused and in original packaging.') },
    attributeSchema: VEHICLE_PARTS_FIELDS,
  });
  await Promise.all(VEHICLE_PARTS_SUBCATEGORIES.map((name, i) => createCategory({
    name,
    slug: `vehicle-parts-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    parentId: vehicleParts._id,
    depth: 1,
    sortOrder: i,
  })));

  const kitchenHome = await createCategory({
    name: 'Kitchen & Home', slug: 'kitchen-home', depth: 0, sortOrder: 1,
    icon: 'home',
    returnPolicy: { returnable: true, windowDays: 7, note: lt('Returnable within 7 days if unused.') },
  });
  await createCategory({ name: 'Cookware', slug: 'kitchen-home-cookware', parentId: kitchenHome._id, depth: 1, sortOrder: 0 });
  await createCategory({
    name: 'Appliances', slug: 'kitchen-home-appliances', parentId: kitchenHome._id, depth: 1, sortOrder: 1,
    attributeSchema: APPLIANCE_FIELDS,
  });
  await createCategory({ name: 'Storage', slug: 'kitchen-home-storage', parentId: kitchenHome._id, depth: 1, sortOrder: 2 });

  const beauty = await createCategory({
    name: 'Beauty & Cosmetics', slug: 'beauty-cosmetics', depth: 0, sortOrder: 2,
    icon: 'sparkles',
    regulated: true,
    reviewRequired: true,
    returnPolicy: { returnable: false, windowDays: 0, note: lt('Not returnable once opened, for hygiene reasons.') },
    attributeSchema: BEAUTY_FIELDS,
  });
  await createCategory({ name: 'Skin care', slug: 'beauty-cosmetics-skin-care', parentId: beauty._id, depth: 1, sortOrder: 0 });
  await createCategory({ name: 'Hair care', slug: 'beauty-cosmetics-hair-care', parentId: beauty._id, depth: 1, sortOrder: 1 });
  await createCategory({ name: 'Makeup', slug: 'beauty-cosmetics-makeup', parentId: beauty._id, depth: 1, sortOrder: 2 });

  return Category.countDocuments({});
}

// --- Vehicles: starter makes/models for the 'fitment' attribute field
// type. Sri Lankan market staples, popular models only — explicitly a
// starter list for the platform owner to correct/extend.
const VEHICLE_MAKES = [
  { name: 'Toyota', type: 'car', models: ['Corolla', 'Axio', 'Premio', 'Allion', 'Vitz', 'Aqua', 'Prius', 'CHR'] },
  { name: 'Toyota', type: 'van', models: ['Hiace', 'Noah', 'Voxy'] },
  { name: 'Toyota', type: 'suv', models: ['Land Cruiser Prado', 'Rush'] },
  { name: 'Suzuki', type: 'car', models: ['Alto', 'Wagon R', 'Swift', 'Celerio'] },
  { name: 'Suzuki', type: 'van', models: ['Every'] },
  { name: 'Honda', type: 'car', models: ['Civic', 'Vezel', 'Fit', 'Grace', 'Insight'] },
  { name: 'Honda', type: 'motorcycle', models: ['CB125', 'CB150'] },
  { name: 'Nissan', type: 'car', models: ['Sunny', 'Bluebird', 'Leaf', 'March', 'Note'] },
  { name: 'Nissan', type: 'van', models: ['Caravan', 'Vanette'] },
  { name: 'Mitsubishi', type: 'car', models: ['Lancer', 'Mirage', 'Attrage'] },
  { name: 'Mitsubishi', type: 'suv', models: ['Montero Sport', 'Outlander'] },
  { name: 'Mazda', type: 'car', models: ['Axela', 'Demio', 'Familia'] },
  { name: 'Hyundai', type: 'car', models: ['Elantra', 'Accent'] },
  { name: 'Hyundai', type: 'suv', models: ['Tucson', 'Creta'] },
  { name: 'Kia', type: 'car', models: ['Rio', 'Cerato'] },
  { name: 'Kia', type: 'suv', models: ['Sportage'] },
  { name: 'Micro', type: 'car', models: ['Panda', 'MX-7', 'Geely Emgrand'] },
  { name: 'Perodua', type: 'car', models: ['Axia', 'Bezza', 'Myvi'] },
  { name: 'Tata', type: 'lorry', models: ['407', 'Dimo Batta'] },
  { name: 'Tata', type: 'three_wheeler', models: ['Magic'] },
  { name: 'Mahindra', type: 'three_wheeler', models: ['Alfa'] },
  { name: 'Mahindra', type: 'lorry', models: ['Bolero Pickup'] },
  { name: 'Bajaj', type: 'three_wheeler', models: ['RE', 'RE Compact'] },
  { name: 'Bajaj', type: 'motorcycle', models: ['Pulsar', 'CT100', 'Discover'] },
  { name: 'TVS', type: 'motorcycle', models: ['Apache', 'Metro', 'Sport'] },
  { name: 'TVS', type: 'three_wheeler', models: ['King'] },
  { name: 'Hero', type: 'motorcycle', models: ['Hunk', 'Splendor', 'Pleasure'] },
  { name: 'Yamaha', type: 'motorcycle', models: ['FZ', 'Ray ZR', 'Fascino'] },
];

async function seedVehicles() {
  await VehicleMake.deleteMany({});
  await VehicleMake.insertMany(VEHICLE_MAKES.map((m) => ({
    name: m.name,
    type: m.type,
    active: true,
    models: m.models.map((name) => ({ name, yearFrom: null, yearTo: null, active: true })),
  })));
  return VehicleMake.countDocuments({});
}

async function seedCatalog() {
  const categoryCount = await seedCategories();
  const makeCount = await seedVehicles();
  return { categoryCount, makeCount };
}

module.exports = { seedCatalog };
