const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');

const sampleProducts = [
  { name: 'NGK Spark Plug B6S', sku_code: 'NGK-B6S', category: 'Bike', sub_category: 'Engine Parts', buying_price: 350, selling_price: 490, stock_quantity: 45, supplier: 'NGK Lanka', low_stock_threshold: 10 },
  { name: 'Denso Spark Plug W16', sku_code: 'DNS-W16', category: 'Three-Wheel', sub_category: 'Engine Parts', buying_price: 280, selling_price: 400, stock_quantity: 30, supplier: 'Denso Auto', low_stock_threshold: 8 },
  { name: 'Bosch Oil Filter DB-4', sku_code: 'BSH-OB4', category: 'Car', sub_category: 'Filters', buying_price: 650, selling_price: 950, stock_quantity: 20, supplier: 'Bosch Lanka', low_stock_threshold: 5 },
  { name: 'Honda Air Filter CB100', sku_code: 'HND-AF100', category: 'Bike', sub_category: 'Filters', buying_price: 450, selling_price: 650, stock_quantity: 3, supplier: 'Honda Parts Sri Lanka', low_stock_threshold: 5 },
  { name: 'Toyota Camry Brake Pad Set', sku_code: 'TOY-BP-CAM', category: 'Car', sub_category: 'Brakes', buying_price: 2800, selling_price: 4200, stock_quantity: 12, supplier: 'Toyota Motors', low_stock_threshold: 3 },
  { name: 'Suzuki Alto Fan Belt', sku_code: 'SUZ-FB-ALT', category: 'Car', sub_category: 'Belts', buying_price: 780, selling_price: 1100, stock_quantity: 8, supplier: 'Suzuki Auto Parts', low_stock_threshold: 3 },
  { name: 'Mahindra Scorpio Engine Mount', sku_code: 'MAH-EM-SCO', category: 'SUV', sub_category: 'Engine Parts', buying_price: 3500, selling_price: 5200, stock_quantity: 4, supplier: 'Mahindra Lanka', low_stock_threshold: 2 },
  { name: 'Three-Wheel Bajaj CVT Belt', sku_code: 'BAJ-CVT-TW', category: 'Three-Wheel', sub_category: 'Transmission', buying_price: 1200, selling_price: 1800, stock_quantity: 15, supplier: 'Bajaj Lanka', low_stock_threshold: 5 },
  { name: 'Land Rover Discovery Shock Absorber', sku_code: 'LR-SA-DIS', category: 'Off-Road', sub_category: 'Suspension', buying_price: 8500, selling_price: 12500, stock_quantity: 0, supplier: 'Land Rover Parts', low_stock_threshold: 2 },
  { name: 'Toyota HiLux Timing Chain Kit', sku_code: 'TOY-TC-HIL', category: 'Off-Road', sub_category: 'Engine Parts', buying_price: 6200, selling_price: 9000, stock_quantity: 2, supplier: 'Toyota Motors', low_stock_threshold: 2 },
  { name: 'Mobil 1 Engine Oil 10W40 (4L)', sku_code: 'MOB-10W40-4L', category: 'Car', sub_category: 'Lubricants', buying_price: 2200, selling_price: 3100, stock_quantity: 25, supplier: 'Mobil Ceylon', low_stock_threshold: 5 },
  { name: 'Isuzu Diesel Injector (D-Max)', sku_code: 'ISZ-INJ-DM', category: 'SUV', sub_category: 'Fuel System', buying_price: 12000, selling_price: 16500, stock_quantity: 3, supplier: 'Isuzu Lanka', low_stock_threshold: 2 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create admin user
    const existing = await User.findOne({ email: 'admin@spareparts.lk' });
    if (!existing) {
      const hashed = await bcrypt.hash('admin123', 10);
      await User.create({ name: 'Admin', email: 'admin@spareparts.lk', password: hashed, role: 'admin', shop: 'Main Branch' });
      console.log('✅ Admin user created: admin@spareparts.lk / admin123');
    } else {
      console.log('⚡ Admin already exists');
    }

    // Seed products
    for (const p of sampleProducts) {
      const exists = await Product.findOne({ sku_code: p.sku_code });
      if (!exists) {
        await Product.create(p);
        console.log(`  + ${p.name}`);
      }
    }
    console.log('✅ Sample products seeded!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
