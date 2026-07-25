const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData =
[
  {
    "sku_code": "BP08",
    "name": "DIO NICKEL SILANCER GUARD",
    "buying_price": 1100,
    "selling_price": 1830,
    "stock_quantity": 3,
    "sub_category": "DIO",
    "category": "Bike"
  },
  {
    "sku_code": "BP09",
    "name": "BAJAJ NICKEL SILANCER GUARD",
    "buying_price": 1050,
    "selling_price": 1830,
    "stock_quantity": 2,
    "sub_category": "BAJAJ",
    "category": "Bike"
  },
  {
    "sku_code": "BP10",
    "name": "NTORQE NICKEL SILANCER GUARD",
    "buying_price": 1200,
    "selling_price": 1830,
    "stock_quantity": 2,
    "sub_category": "NTORQE",
    "category": "Bike"
  },
  {
    "sku_code": "BP11",
    "name": "FZ NICKEL SILANCER GUARD",
    "buying_price": 1000,
    "selling_price": 1830,
    "stock_quantity": 1,
    "sub_category": "FZ",
    "category": "Bike"
  },
  {
    "sku_code": "BP12",
    "name": "ZR NICKEL SILANCER GUARD",
    "buying_price": 1050,
    "selling_price": 1830,
    "stock_quantity": 2,
    "sub_category": "ZR",
    "category": "Bike"
  },
  {
    "sku_code": "BP13",
    "name": "CT100 NICKEL SILANCER GUARD",
    "buying_price": 1050,
    "selling_price": 1830,
    "stock_quantity": 7,
    "sub_category": "CT100",
    "category": "Bike"
  },
  {
    "sku_code": "BH09",
    "name": "ACTIVE UP2",
    "buying_price": 3350,
    "selling_price": 4350,
    "stock_quantity": 2,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BH10",
    "name": "CHALLENGER DOUBLE VISOR HELMET BLACK MAT",
    "buying_price": 4450,
    "selling_price": 5500,
    "stock_quantity": 1,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BH11",
    "name": "SSG HELMET",
    "buying_price": 2650,
    "selling_price": 3700,
    "stock_quantity": 1,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BH12",
    "name": "ACHIEVE HELMET",
    "buying_price": 2250,
    "selling_price": 3300,
    "stock_quantity": 1,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BH13",
    "name": "LS2 STICKER LADIES HELMET",
    "buying_price": 1650,
    "selling_price": 2700,
    "stock_quantity": 1,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BH14",
    "name": "LS2 LADIES HELMET",
    "buying_price": 1550,
    "selling_price": 2500,
    "stock_quantity": 1,
    "sub_category": "HELMAT",
    "category": "Bike"
  },
  {
    "sku_code": "BP136",
    "name": "NS200 BLACK RADIATOR GUARD",
    "buying_price": 1350,
    "selling_price": 2000,
    "stock_quantity": 1,
    "sub_category": "NS",
    "category": "Bike"
  },
  {
    "sku_code": "BP137",
    "name": "NEW DIO NICKEL SILANCER GUARD",
    "buying_price": 1300,
    "selling_price": 2000,
    "stock_quantity": 5,
    "sub_category": "DIO",
    "category": "Bike"
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
