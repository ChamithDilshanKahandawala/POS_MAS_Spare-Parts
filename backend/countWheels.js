const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

async function countThreeWheelItems() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await Product.countDocuments({ category: 'Three-Wheel' });
    const totalCount = await Product.countDocuments();
    console.log(`__COUNT_${count}_TOTAL_${totalCount}__`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

countThreeWheelItems();
