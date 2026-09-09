const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData =
[
  {
    "sku_code": "BP157",
    "name": "BIKE PHONE HOLDER WITH USB",
    "buying_price": 650,
    "selling_price": 1350,
    "stock_quantity": 5,
    "sub_category": "PHONE HOLDER",
    "category": "Bike"
  },
  {
    "sku_code": "AVH03",
    "name": "MINI VIP HORN",
    "buying_price": 850,
    "selling_price": 1500,
    "stock_quantity": 5,
    "sub_category": "HORN",
    "category": "ANYVEHICLE"
  },
  {
    "sku_code": "TWF39",
    "name": "FM ANTANA GREEN",
    "buying_price": 800,
    "selling_price": 1400,
    "stock_quantity": 3,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF99",
    "name": "FM ANTANA WHITE",
    "buying_price": 800,
    "selling_price": 1400,
    "stock_quantity": 50,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF100",
    "name": "FM ANTANA YELLOW",
    "buying_price": 800,
    "selling_price": 1400,
    "stock_quantity": 50,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLHL13",
    "name": "TWO RING HEADLIGHT Q1",
    "buying_price": 2100,
    "selling_price": 3000,
    "stock_quantity": 20,
    "sub_category": "Head Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWWBS17",
    "name": "SET BOX COVER",
    "buying_price": 330,
    "selling_price": 650,
    "stock_quantity": 10,
    "sub_category": "Sound Set",
    "category": "Three-Wheel"
  }
];
 

async function seedInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`\n📦 Seeding ${inventoryData.length} Mixed Parts (Sound, VIP Lights, Dash Items, etc)...`);
    console.log('─'.repeat(90));

    let added = 0, updated = 0;

    for (const item of inventoryData) {
      const exists = await Product.findOne({ sku_code: item.sku_code });
      if (exists) {
        await Product.findOneAndUpdate({ sku_code: item.sku_code }, {
          name: item.name,
          buying_price: item.buying_price,
          selling_price: item.selling_price,
          sub_category: item.sub_category,
          stock_quantity: item.stock_quantity,
          category: item.category,
        });
        console.log(`  ↺ Updated : ${item.sku_code} | ${item.name}`);
        updated++;
      } else {
        await Product.create(item);
        const margin = item.selling_price > 0 ? (((item.selling_price - item.buying_price) / item.selling_price) * 100).toFixed(0) : 0;
        console.log(`  ✅ Added  : ${item.sku_code} | ${item.name.padEnd(55)} | Buy: Rs.${String(item.buying_price).padStart(5)} | Sell: Rs.${String(item.selling_price).padStart(5)} | Margin: ${margin}%`);
        added++;
      }
    }

    console.log('─'.repeat(90));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Newly added : ${added}`);
    console.log(`   ↺ Updated     : ${updated}`);
    console.log(`   Total processed: ${inventoryData.length}`);
    console.log('\n🎉 Parts seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedInventory();
