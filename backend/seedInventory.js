const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData = 
[
  
  {
    "sku_code": "TWLFL09",
    "name": "Two Pic Fog Light 1 PCS",
    "buying_price": 325,
    "selling_price": 600,
    "stock_quantity": 20,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL12",
    "name": "Wellampiti Full Light Set Blue",
    "buying_price": 5000,
    "selling_price": 6850,
    "stock_quantity": null,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL13",
    "name": "Wellampiti Full Light Set Green",
    "buying_price": 5000,
    "selling_price": 6850,
    "stock_quantity": null,
    "sub_category": "Wellampiti Light",
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
