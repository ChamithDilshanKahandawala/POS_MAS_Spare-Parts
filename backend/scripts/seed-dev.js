// Seeds the isolated dev database (storefront_dev) with realistic test
// data: ~40 products across the real categories, one admin and one
// customer login. This is destructive (wipes Products + the two dev
// users first) so it carries its own guard below, in addition to (not
// instead of) the one connectDB() applies when it actually connects —
// this one runs first and purely from string inspection, so it can print
// the target and refuse *before* a connection is even opened.
//
// Usage:
//   npm run seed:dev -- --yes                        — wipe + reseed dev
//   npm run seed:dev -- --yes --from-prod-readonly    — also copy real
//       product data (read-only) from production into dev; ask before
//       using this
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.development') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const { PRODUCTION_DB_NAME, getDbNameFromUri } = connectDB;
const Product = require('../models/Product');
const User = require('../models/User');

function guardAgainstProduction() {
  const dbName = getDbNameFromUri(process.env.MONGO_URI);
  console.log(`Target database: "${dbName || '(could not parse MONGO_URI)'}"`);

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run: NODE_ENV=production. This script wipes data — it never runs in production, regardless of which database MONGO_URI points at.');
    process.exit(1);
  }
  if (dbName === PRODUCTION_DB_NAME) {
    console.error(`❌ Refusing to run: MONGO_URI points at the production database ("${dbName}"). Point it at a dev database (e.g. "storefront_dev") in backend/.env.development instead.`);
    process.exit(1);
  }
  if (!process.argv.includes('--yes')) {
    console.error('❌ Refusing to run without --yes. This wipes the Products collection and the two dev login users in the database above. Re-run as: npm run seed:dev -- --yes');
    process.exit(1);
  }
}

const CATEGORIES = ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road', 'KeyTag', 'Toys', 'Ornaments', 'Electronics', 'Company Item', 'ANYVEHICLE'];

// Cycle through these so the seeded catalog has a realistic mix of
// out-of-stock (0), low-stock (1-4, triggers the storefront's low-stock
// note since the schema's low_stock_threshold default is 5) and
// healthy-stock products.
const STOCK_CYCLE = [0, 2, 4, 3, 1, 0, 12, 25, 8, 40];

const PRODUCT_NAMES = {
  'Three-Wheel': ['Steering Wheel Cover', 'Body Kit Front', 'Dashboard Mat', 'Side Mirror Set', 'Seat Cover'],
  Bike: ['Chain Sprocket Set', 'Brake Pad Set', 'Headlight Assembly', 'Side Mirror', 'Fuel Tank Cap'],
  Car: ['Air Filter', 'Wiper Blade Set', 'Floor Mat Set', 'Cabin Filter', 'Spark Plug Set'],
  SUV: ['Roof Rail', 'Mud Flap Set', 'Fog Lamp Set', 'Tow Hook', 'Running Board'],
  'Off-Road': ['Skid Plate', 'Winch Mount', 'Snorkel Kit', 'Recovery Strap', 'Rock Slider'],
  KeyTag: ['Leather Key Tag', 'Metal Key Tag', 'Keychain Fob', 'Key Cover Case'],
  Toys: ['Dashboard Bobblehead', 'Hanging Ornament Toy', 'Mini Model Car'],
  Ornaments: ['Hood Ornament', 'Dashboard Deity Figure', 'Hanging Charm'],
  Electronics: ['USB Charger Dual Port', 'Bluetooth FM Transmitter', 'Dash Cam', 'Reverse Camera'],
  'Company Item': ['Branded Cap', 'Branded T-Shirt', 'Service Voucher Card'],
  ANYVEHICLE: ['Tire Shine Spray', 'Microfiber Cloth Pack', 'Jump Starter Pack', 'Tool Kit Set'],
};

function buildProducts() {
  const products = [];
  let i = 0;
  for (const category of CATEGORIES) {
    for (const name of PRODUCT_NAMES[category]) {
      const stock = STOCK_CYCLE[i % STOCK_CYCLE.length];
      const buying = 300 + (i % 12) * 150;
      products.push({
        name: `${name.toUpperCase()}`,
        sku_code: `DEV-${category.replace(/\s|-/g, '').slice(0, 4).toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
        brand: 'Generic',
        category,
        sub_category: 'General',
        buying_price: buying,
        selling_price: Math.round(buying * 1.6),
        stock_quantity: stock,
        low_stock_threshold: 5,
        description: `Dev seed data — ${name} for ${category}.`,
      });
      i += 1;
    }
  }
  return products;
}

async function copyFromProdReadonly() {
  const prodUri = process.env.PROD_MONGO_URI_READONLY;
  if (!prodUri) {
    console.error('❌ --from-prod-readonly requires PROD_MONGO_URI_READONLY to be set in the shell (not committed anywhere). Aborting this step.');
    return [];
  }
  console.log('🔎 Opening a read-only connection to production to copy products...');
  const prodConn = await mongoose.createConnection(prodUri).asPromise();
  const ProdProduct = prodConn.model('Product', Product.schema);
  const prodProducts = await ProdProduct.find({}).lean();
  await prodConn.close();
  console.log(`📦 Read ${prodProducts.length} products from production (read-only, nothing written there).`);
  return prodProducts.map(({ _id, __v, createdAt, updatedAt, ...rest }) => rest);
}

async function seed() {
  guardAgainstProduction();
  await connectDB(); // redundant with the guard above, but connectDB() is also the thing that actually opens the connection

  const fromProd = process.argv.includes('--from-prod-readonly');

  await Product.deleteMany({});
  await User.deleteMany({ email: { $in: ['dev.admin@mas.test', 'dev.customer@mas.test'] } });
  console.log('🧹 Cleared dev Products collection and the two dev login users.');

  const products = fromProd ? await copyFromProdReadonly() : buildProducts();
  await Product.insertMany(products);
  console.log(`📦 Inserted ${products.length} products${fromProd ? ' (copied from production)' : ''}.`);

  const salt = await bcrypt.genSalt(10);
  const adminPassword = 'DevAdmin123!';
  const customerPassword = 'DevCustomer123!';

  await User.create({
    name: 'Dev Admin',
    email: 'dev.admin@mas.test',
    password: await bcrypt.hash(adminPassword, salt),
    role: 'admin',
    status: 'active',
    isActive: true,
  });
  await User.create({
    name: 'Dev Customer',
    email: 'dev.customer@mas.test',
    password: await bcrypt.hash(customerPassword, salt),
    role: 'customer',
    status: 'active',
    isActive: true,
  });

  console.log('\n✅ Dev seed complete.');
  console.log('-----------------------------------');
  console.log('Admin login:    dev.admin@mas.test / ' + adminPassword);
  console.log('Customer login: dev.customer@mas.test / ' + customerPassword);
  console.log('-----------------------------------');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
