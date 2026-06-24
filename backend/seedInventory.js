const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData = 

    [
  {
    "sku_code": "DO10",
    "name": "CRYSTAL LED 6CM 6452B",
    "buying_price": 450,
    "selling_price": 1250,
    "stock_quantity": 6,
    "sub_category": "Decor",
    "category": "Ornaments"
  },
  {
    "sku_code": "TWW02",
    "name": "9 PIN FRONT WIREHARNESS",
    "buying_price": 2450,
    "selling_price": 3450,
    "stock_quantity": null,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW03",
    "name": "9 PIN REAR WIREHARNESS",
    "buying_price": 2000,
    "selling_price": 3000,
    "stock_quantity": null,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW06",
    "name": "6 PIN FRONT WIREHARNESS SUN",
    "buying_price": 1900,
    "selling_price": 3250,
    "stock_quantity": 2,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW07",
    "name": "6 PIN REAR WIREHARNESS SUN",
    "buying_price": 1850,
    "selling_price": 3100,
    "stock_quantity": 2,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP36",
    "name": "VIPER MOTOR 2STOCK VARROC",
    "buying_price": 3850,
    "selling_price": 4600,
    "stock_quantity": 1,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWSP37",
    "name": "VIPER MOTOR 4STOCK VARROC",
    "buying_price": 5900,
    "selling_price": 6850,
    "stock_quantity": 1,
    "sub_category": "Spare parts",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "BL01",
    "name": "3500LM M6 LED HEADLIGHT",
    "buying_price": 1000,
    "selling_price": 1550,
    "stock_quantity": 5,
    "sub_category": "HEADLIGHT",
    "category": "Bike"
  },
  {
    "sku_code": "BP102",
    "name": "WATERPROOF PHONE HOLDER CASE",
    "buying_price": 900,
    "selling_price": 1600,
    "stock_quantity": 5,
    "sub_category": "PHONE HOLDER",
    "category": "Bike"
  },
  {
    "sku_code": "TWLFL11",
    "name": "16 LED WHITE FOG LIGHT",
    "buying_price": 300,
    "selling_price": 500,
    "stock_quantity": 5,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL12",
    "name": "21 LED WHITE FOG LIGHT",
    "buying_price": 450,
    "selling_price": 850,
    "stock_quantity": 5,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL13",
    "name": "DIO WHITE FOG LIGHT PAIR",
    "buying_price": 450,
    "selling_price": 850,
    "stock_quantity": 4,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL14",
    "name": "15 LED WHITE FOG LIGHT",
    "buying_price": 225,
    "selling_price": 450,
    "stock_quantity": 5,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWLFL15",
    "name": "BB2537 OFFROAD FOG LIGHT",
    "buying_price": 1500,
    "selling_price": 2500,
    "stock_quantity": 2,
    "sub_category": "Fog Light",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWW08",
    "name": "15A KAIER FUSE",
    "buying_price": 6,
    "selling_price": 25,
    "stock_quantity": 100,
    "sub_category": "Wiring",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBB06",
    "name": "Break Blink LED",
    "buying_price": 75,
    "selling_price": 150,
    "stock_quantity": 20,
    "sub_category": "Bulb",
    "category": null
  },
  {
    "sku_code": "TWBB07",
    "name": "AUTO LAMP SIGNAL BULB",
    "buying_price": 40,
    "selling_price": 75,
    "stock_quantity": 10,
    "sub_category": "Bulb",
    "category": null
  },
  {
    "sku_code": "TWBB03",
    "name": "Y7 H4 HEADLIGHT BULB",
    "buying_price": 2000,
    "selling_price": 2800,
    "stock_quantity": 1,
    "sub_category": "Bulb",
    "category": "Bike"
  },
  {
    "sku_code": "BP83",
    "name": "ON OFF RED BIKE HANDLE SWITCH",
    "buying_price": 100,
    "selling_price": 250,
    "stock_quantity": 10,
    "sub_category": "Switch",
    "category": "Bike"
  },
  {
    "sku_code": "TWBT33",
    "name": "TYPE R BATCH",
    "buying_price": 300,
    "selling_price": 450,
    "stock_quantity": 5,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT34",
    "name": "LIMITED RED BATCH",
    "buying_price": 300,
    "selling_price": 450,
    "stock_quantity": 3,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT35",
    "name": "SPORT RED BATCH",
    "buying_price": 300,
    "selling_price": 450,
    "stock_quantity": 3,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT36",
    "name": "LIMITED SILVER BATCH",
    "buying_price": 300,
    "selling_price": 450,
    "stock_quantity": 5,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWBT37",
    "name": "TRD SPORT BATCH",
    "buying_price": 125,
    "selling_price": 250,
    "stock_quantity": 5,
    "sub_category": "Batch",
    "category": "Three-Wheel"
  },
  {
    "sku_code": "TWF73",
    "name": "PLASTIC ROUND SWIMARM OLD BOBIN",
    "buying_price": 300,
    "selling_price": 600,
    "stock_quantity": 10,
    "sub_category": "Front",
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
