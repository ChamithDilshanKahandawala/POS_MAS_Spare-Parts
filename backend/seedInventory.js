const mongoose = require('mongoose');
require('./scripts/lib/loadDevEnv')();
const Product = require('./models/Product');

const inventoryData =
[
  {
    "sku_code": "TWLWL02",
    "name": "WELLAMPITI BUFFER LIGHT Q2 MULTICOLOR",
    "buying_price": 800,
    "selling_price": 1500,
    "stock_quantity": 9,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL32",
    "name": "WELLAMPITI BUFFER LIGHT Q2 BLUE",
    "buying_price": 800,
    "selling_price": 1500,
    "stock_quantity": 3,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL18",
    "name": "WELLAMPITI GLASS LIGHT Q2 RED MULTICOLOR",
    "buying_price": 800,
    "selling_price": 1500,
    "stock_quantity": 2,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL17",
    "name": "WELLAMPITI BADA LIGHT Q2 MULTICOLOR",
    "buying_price": 800,
    "selling_price": 1500,
    "stock_quantity": 7,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL03",
    "name": "WELLAMPITI BADA LIGHT Q2 BLUE",
    "buying_price": 800,
    "selling_price": 1500,
    "stock_quantity": 3,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL05",
    "name": "WELLAMPITI MADA CARPET LIGHT PAIR RED",
    "buying_price": 550,
    "selling_price": 1000,
    "stock_quantity": 7,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL33",
    "name": "WELLAMPITI MADA CARPET LIGHT PAIR GREEN",
    "buying_price": 550,
    "selling_price": 1000,
    "stock_quantity": 5,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL34",
    "name": "WELLAMPITI MADA CARPET LIGHT PAIR BLUE",
    "buying_price": 550,
    "selling_price": 1000,
    "stock_quantity": 3,
    "sub_category": "Wellampiti Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL35",
    "name": "LIGHT HORN GUARD DARMA CHAKRAYA MT",
    "buying_price": 4950,
    "selling_price": 6100,
    "stock_quantity": 3,
    "sub_category": "MTD MODIFICATION",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL36",
    "name": "KULLA LONG LIGHT MT",
    "buying_price": 2950,
    "selling_price": 4100,
    "stock_quantity": 3,
    "sub_category": "MTD MODIFICATION",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL37",
    "name": "SIDE MIRROR WITH LIGHT MT",
    "buying_price": 2050,
    "selling_price": 3300,
    "stock_quantity": 3,
    "sub_category": "MTD MODIFICATION",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL38",
    "name": "LIGHT HORN GUARD WITH NUMBER MT",
    "buying_price": 5350,
    "selling_price": 6600,
    "stock_quantity": 1,
    "sub_category": "MTD MODIFICATION",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL39",
    "name": "DASHBOARD LONG LIGHT MT",
    "buying_price": 2950,
    "selling_price": 4100,
    "stock_quantity": 3,
    "sub_category": "MTD MODIFICATION",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLWL40",
    "name": "BACK DOOR LIGHT MT",
    "buying_price": 3850,
    "selling_price": 5100,
    "stock_quantity": 1,
    "sub_category": "MTD MODIFICATION",
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
