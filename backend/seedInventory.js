const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData =
[
  {
    "sku_code": "TWI52",
    "name": "JP STEERING WHEEL COVER BROWN",
    "buying_price": 900,
    "selling_price": 1350,
    "stock_quantity": 0,
    "sub_category": "INSIDE",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWI53",
    "name": "JP STEERING WHEEL COVER BLACK",
    "buying_price": 900,
    "selling_price": 1350,
    "stock_quantity": 0,
    "sub_category": "INSIDE",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF61",
    "name": "2ST BODY KIT GREEN",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 0,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF82",
    "name": "4ST BODY KIT GREEN",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 1,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF108",
    "name": "2ST BODY KIT GREEN",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 0,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF109",
    "name": "2ST BODY KIT BLACK",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 1,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF110",
    "name": "2ST BODY KIT BLUE",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 0,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF111",
    "name": "4ST BODY KIT BLACK",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 0,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF112",
    "name": "4ST BODY KIT BLUE",
    "buying_price": 1400,
    "selling_price": 2380,
    "stock_quantity": 1,
    "sub_category": "Front",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWDI43",
    "name": "BUWALLA S",
    "buying_price": 100,
    "selling_price": 250,
    "stock_quantity": 12,
    "sub_category": "Dashboard Item",
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
