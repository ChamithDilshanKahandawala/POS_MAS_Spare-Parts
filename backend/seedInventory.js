const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');

// =============================================
// REAL INVENTORY DATA - THREE WHEEL FRONT PARTS
// Source: User's spreadsheet (Front section)
// =============================================
const inventoryData = [
  // ── HEADLIGHT PARTS ──────────────────────────
  {
    name: 'Plastic Headlight Cap',
    sku_code: 'TW-006-PHCAP',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 80,
    selling_price: 200,
    stock_quantity: 50,
    low_stock_threshold: 10,
    supplier: '',
    description: 'Item No. 6',
  },
  {
    name: 'Nickel Headlight Cap',
    sku_code: 'TW-102-NHCAP',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 180,
    selling_price: 350,
    stock_quantity: 30,
    low_stock_threshold: 8,
    supplier: '',
    description: 'Item No. 102',
  },
  {
    name: 'Headlight Viser Nikel Kuru',
    sku_code: 'TW-040-HVNK',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 425,
    selling_price: 600,
    stock_quantity: 20,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 40',
  },
  {
    name: 'Titanium Kura',
    sku_code: 'TW-055-TIKURA',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 500,
    selling_price: 800,
    stock_quantity: 15,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 55',
  },
  {
    name: 'Plastic Doom',
    sku_code: 'TW-179-PLDOOM',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 165,
    selling_price: 500,
    stock_quantity: 25,
    low_stock_threshold: 8,
    supplier: '',
    description: 'Item No. 179',
  },
  {
    name: 'Nickel Headlight Doom',
    sku_code: 'TW-130-NHDOOM',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 1400,
    selling_price: 2100,
    stock_quantity: 10,
    low_stock_threshold: 3,
    supplier: '',
    description: 'Item No. 130',
  },
  {
    name: 'Headlight Normal Ring',
    sku_code: 'TW-000-HNRING',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 0,
    selling_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Headlight Normal Ring - price to be updated',
  },
  {
    name: 'Headlight Nickel Ring',
    sku_code: 'TW-086-HNKRING',
    category: 'Three-Wheel',
    sub_category: 'Headlight Parts',
    buying_price: 450,
    selling_price: 650,
    stock_quantity: 20,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 86',
  },

  // ── MUD GUARD ────────────────────────────────
  {
    name: 'Front Mud Guard Nickel Wata (Nickle Otunna)',
    sku_code: 'TW-070-FMGNW',
    category: 'Three-Wheel',
    sub_category: 'Body Parts',
    buying_price: 2900,
    selling_price: 3450,
    stock_quantity: 8,
    low_stock_threshold: 3,
    supplier: '',
    description: 'Item No. 70 - Front mud guard nickel wata',
  },

  // ── NAHAYA ───────────────────────────────────
  {
    name: 'Nahaya',
    sku_code: 'TW-075-NAHAYA',
    category: 'Three-Wheel',
    sub_category: 'Body Parts',
    buying_price: 700,
    selling_price: 950,
    stock_quantity: 12,
    low_stock_threshold: 4,
    supplier: '',
    description: 'Item No. 75 - Nahaya',
  },

  // ── VIPER (WIPER) PARTS ───────────────────────
  {
    name: 'Viper Rubber',
    sku_code: 'TW-063-VIPRUB',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 150,
    selling_price: 300,
    stock_quantity: 40,
    low_stock_threshold: 10,
    supplier: '',
    description: 'Item No. 63 - Wiper rubber blade',
  },
  {
    name: 'Viper Hand',
    sku_code: 'TW-004-VIPHAND',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 225,
    selling_price: 400,
    stock_quantity: 30,
    low_stock_threshold: 8,
    supplier: '',
    description: 'Item No. 4 - Wiper arm/hand',
  },
  {
    name: 'Viper Blade',
    sku_code: 'TW-147-VIPBLD',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 300,
    selling_price: 500,
    stock_quantity: 25,
    low_stock_threshold: 8,
    supplier: '',
    description: 'Item No. 147 - Wiper blade',
  },
  {
    name: 'Viper Normal',
    sku_code: 'TW-165-VIPNRM',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 400,
    selling_price: 750,
    stock_quantity: 20,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 165 - Normal wiper set',
  },
  {
    name: 'Viper Hoda 1',
    sku_code: 'TW-166-VIPHD1',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 425,
    selling_price: 700,
    stock_quantity: 18,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 166 - Hoda 1 wiper',
  },
  {
    name: 'Viper Normal + Rubber + Blade',
    sku_code: 'TW-167-VIPNRB',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 700,
    selling_price: 1250,
    stock_quantity: 15,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 167 - Complete wiper kit (Normal + Rubber + Blade)',
  },
  {
    name: 'Viper Hoda 1 + Rubber + Blade',
    sku_code: 'TW-168-VIPHRB',
    category: 'Three-Wheel',
    sub_category: 'Wiper Parts',
    buying_price: 1150,
    selling_price: 1600,
    stock_quantity: 12,
    low_stock_threshold: 4,
    supplier: '',
    description: 'Item No. 168 - Complete wiper kit (Hoda 1 + Rubber + Blade)',
  },

  // ── SIDE MIRROR ───────────────────────────────
  {
    name: 'Side Mirror',
    sku_code: 'TW-039-SMIR',
    category: 'Three-Wheel',
    sub_category: 'Mirrors',
    buying_price: 380,
    selling_price: 600,
    stock_quantity: 20,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 39 - Side mirror',
  },
  {
    name: 'Side Mirror Bar Nickle',
    sku_code: 'TW-080-SMIRBN',
    category: 'Three-Wheel',
    sub_category: 'Mirrors',
    buying_price: 260,
    selling_price: 450,
    stock_quantity: 25,
    low_stock_threshold: 5,
    supplier: '',
    description: 'Item No. 80 - Side mirror bar nickel',
  },
];

async function seedInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    console.log('');
    console.log('📦 Adding Three-Wheel Front Parts...');
    console.log('─'.repeat(55));

    let added = 0;
    let skipped = 0;
    let updated = 0;

    for (const item of inventoryData) {
      const exists = await Product.findOne({ sku_code: item.sku_code });
      if (exists) {
        // Update existing product with latest prices
        await Product.findOneAndUpdate(
          { sku_code: item.sku_code },
          {
            buying_price: item.buying_price,
            selling_price: item.selling_price,
            sub_category: item.sub_category,
            description: item.description,
          }
        );
        console.log(`  ↺ Updated : ${item.name}`);
        updated++;
      } else {
        await Product.create(item);
        const margin = item.selling_price > 0
          ? (((item.selling_price - item.buying_price) / item.selling_price) * 100).toFixed(0)
          : 0;
        console.log(
          `  ✅ Added  : ${item.name.padEnd(42)} | Buy: Rs.${String(item.buying_price).padStart(5)} | Sell: Rs.${String(item.selling_price).padStart(5)} | Margin: ${margin}%`
        );
        added++;
      }
    }

    console.log('─'.repeat(55));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Newly added : ${added} products`);
    console.log(`   ↺ Updated     : ${updated} products`);
    console.log(`   Total processed: ${inventoryData.length} products`);
    console.log('\n🎉 Inventory seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedInventory();
