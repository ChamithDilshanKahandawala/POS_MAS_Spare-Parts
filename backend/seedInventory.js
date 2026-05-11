const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

const inventoryData = [
  {
    "name": "Wheel wellampiti sound set",
    "sku_code": "TWWBS01",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 20000,
    "selling_price": 25000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Car Set MP3 Player",
    "sku_code": "TWWBS02",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 1800,
    "selling_price": 2450,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Wellampiti Loku White Box Pair",
    "sku_code": "TWWBS03",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 8000,
    "selling_price": 9000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Wellampiti Loku mp3 Player Box one Door",
    "sku_code": "TWWBS04",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 5500,
    "selling_price": 6200,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Wellampiti Loku mp3 Player Box 2 Door",
    "sku_code": "TWWBS05",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 6500,
    "selling_price": 7200,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Pioneer Speaker Pair",
    "sku_code": "TWWBS06",
    "category": "Three-Wheel",
    "sub_category": "Sound Set",
    "buying_price": 7000,
    "selling_price": 8000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "podi bobin",
    "sku_code": "TWBEN01",
    "category": "Three-Wheel",
    "sub_category": "Bobin",
    "buying_price": 20,
    "selling_price": 30,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "star bobin",
    "sku_code": "TWBEN02",
    "category": "Three-Wheel",
    "sub_category": "Bobin",
    "buying_price": 15,
    "selling_price": 25,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "13 Cap Nut",
    "sku_code": "TWBEN03",
    "category": "Three-Wheel",
    "sub_category": "Nut",
    "buying_price": 17,
    "selling_price": 50,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "17 Cap Nut",
    "sku_code": "TWBEN04",
    "category": "Three-Wheel",
    "sub_category": "Nut",
    "buying_price": 23,
    "selling_price": 50,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "mune ana 1(8 Ena)",
    "sku_code": "TWBEN05",
    "category": "Three-Wheel",
    "sub_category": "Ena",
    "buying_price": 20,
    "selling_price": 50,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Thattu Ena 1",
    "sku_code": "TWBEN06",
    "category": "Three-Wheel",
    "sub_category": "Ena",
    "buying_price": 45,
    "selling_price": 100,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Round Nut Bobin",
    "sku_code": "TWBEN07",
    "category": "Three-Wheel",
    "sub_category": "Bobin",
    "buying_price": 9,
    "selling_price": 25,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "S12 VIP Viser(dashboard) light",
    "sku_code": "TWLVIP01",
    "category": "Three-Wheel",
    "sub_category": "VIP Light",
    "buying_price": 1650,
    "selling_price": 2250,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "VIP light green box",
    "sku_code": "TWLVIP02",
    "category": "Three-Wheel",
    "sub_category": "VIP Light",
    "buying_price": 850,
    "selling_price": 1500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "white yellow light bar 4",
    "sku_code": "TWLVIP03",
    "category": "Three-Wheel",
    "sub_category": "VIP Light",
    "buying_price": 2500,
    "selling_price": 3800,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "white yellow light bar 5",
    "sku_code": "TWLVIP04",
    "category": "Three-Wheel",
    "sub_category": "VIP Light",
    "buying_price": 3000,
    "selling_price": 4200,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "white yellow light bar 6",
    "sku_code": "TWLVIP05",
    "category": "Three-Wheel",
    "sub_category": "VIP Light",
    "buying_price": 3500,
    "selling_price": 4800,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Dash board",
    "sku_code": "TWDI01",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1150,
    "selling_price": 1500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Black Dashboard",
    "sku_code": "TWDI02",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1300,
    "selling_price": 1850,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Black Dashboard With Upper Cussion",
    "sku_code": "TWDI03",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1350,
    "selling_price": 1900,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Heda white Dashboard",
    "sku_code": "TWDI04",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1875,
    "selling_price": 2400,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Thattu 2 Heda white Dashboard",
    "sku_code": "TWDI05",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 2475,
    "selling_price": 3000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Dash board Bracket",
    "sku_code": "TWDI06",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 160,
    "selling_price": 300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "DJ light",
    "sku_code": "TWDI07",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 165,
    "selling_price": 300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Mini Hat Man",
    "sku_code": "TWDI08",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 495,
    "selling_price": 850,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Mini Joker",
    "sku_code": "TWDI09",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 495,
    "selling_price": 850,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "loku joker",
    "sku_code": "TWDI10",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1700,
    "selling_price": 2500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "stand podi joker",
    "sku_code": "TWDI11",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1300,
    "selling_price": 1850,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Small joker",
    "sku_code": "TWDI12",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1300,
    "selling_price": 1800,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Doll air freshner(roboticca)",
    "sku_code": "TWDI13",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 525,
    "selling_price": 1000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Solar power dashboard helicopter",
    "sku_code": "TWDI14",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 850,
    "selling_price": 1300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "dashboard ship bottle",
    "sku_code": "TWDI15",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 850,
    "selling_price": 1200,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Dashboard solar statue",
    "sku_code": "TWDI16",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1200,
    "selling_price": 1600,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Couple Doll",
    "sku_code": "TWDI17",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 450,
    "selling_price": 750,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "New Round Ship Bottle",
    "sku_code": "TWDI18",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1000,
    "selling_price": 1600,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "USB charging port 5",
    "sku_code": "TWDI19",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1350,
    "selling_price": 1850,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "phone holder",
    "sku_code": "TWDI20",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 550,
    "selling_price": 700,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Plasma Lamp",
    "sku_code": "TWDI21",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1900,
    "selling_price": 2600,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Phone Number Show Decor",
    "sku_code": "TWDI22",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 400,
    "selling_price": 800,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Sound Bar",
    "sku_code": "TWDI23",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 850,
    "selling_price": 1250,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Speed Meter",
    "sku_code": "TWDI24",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 1950,
    "selling_price": 2500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "ath dala",
    "sku_code": "TWDI25",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 190,
    "selling_price": 300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "solar circle statue",
    "sku_code": "TWDI26",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 500,
    "selling_price": 900,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "solar circle statue with universe ball",
    "sku_code": "TWDI27",
    "category": "Three-Wheel",
    "sub_category": "Dashboard Item",
    "buying_price": 600,
    "selling_price": 1100,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "3-Code Light Pati",
    "sku_code": "TWLO01",
    "category": "Three-Wheel",
    "sub_category": "Other Lights",
    "buying_price": 150,
    "selling_price": 300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "front tent side light",
    "sku_code": "TWLO02",
    "category": "Three-Wheel",
    "sub_category": "Other Lights",
    "buying_price": 500,
    "selling_price": 700,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "rear light pati",
    "sku_code": "TWLO03",
    "category": "Three-Wheel",
    "sub_category": "Other Lights",
    "buying_price": 850,
    "selling_price": 1000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Driver Seat Light Podi",
    "sku_code": "TWLO04",
    "category": "Three-Wheel",
    "sub_category": "Other Lights",
    "buying_price": 150,
    "selling_price": 400,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Driver Seat Light Loku",
    "sku_code": "TWLO05",
    "category": "Three-Wheel",
    "sub_category": "Other Lights",
    "buying_price": 200,
    "selling_price": 500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Siren Horn",
    "sku_code": "TWH01",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 750,
    "selling_price": 1300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "18 Sound Horn",
    "sku_code": "TWH02",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 1025,
    "selling_price": 1550,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Bseoch Horn",
    "sku_code": "TWH03",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 850,
    "selling_price": 1300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "roadmaster horn set(cicada)",
    "sku_code": "TWH04",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 3200,
    "selling_price": 5000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Transistor Horn",
    "sku_code": "TWH05",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 5000,
    "selling_price": 6500,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "MIC horn",
    "sku_code": "TWH06",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 1700,
    "selling_price": 2300,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "kili kili wellampiti horn circuit",
    "sku_code": "TWH07",
    "category": "Three-Wheel",
    "sub_category": "Horn",
    "buying_price": 550,
    "selling_price": 800,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "20 AMP FUSE",
    "sku_code": "TWW01",
    "category": "Three-Wheel",
    "sub_category": "Wiring",
    "buying_price": 6,
    "selling_price": 20,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Wireness 9 Pin Front",
    "sku_code": "TWW02",
    "category": "Three-Wheel",
    "sub_category": "Wiring",
    "buying_price": 2450,
    "selling_price": 3450,
    "stock_quantity": 0,
    "low_stock_threshold": 5
  },
  {
    "name": "Wireness 9 Pin Back",
    "sku_code": "TWW03",
    "category": "Three-Wheel",
    "sub_category": "Wiring",
    "buying_price": 2000,
    "selling_price": 3000,
    "stock_quantity": 0,
    "low_stock_threshold": 5
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
