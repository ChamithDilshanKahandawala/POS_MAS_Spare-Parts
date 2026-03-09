const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku_code: { type: String, required: true, unique: true, uppercase: true },
    category: {
      type: String,
      required: true,
      enum: ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road'],
    },
    sub_category:        { type: String, default: '' },
    unit:                { type: String, enum: ['Units', 'Liters', 'Packets', 'Meters', 'Sets', 'Pairs', 'Kg'], default: 'Units' },
    buying_price:        { type: Number, required: true, min: 0 },
    selling_price:       { type: Number, required: true, min: 0 },
    stock_quantity:      { type: Number, required: true, default: 0, min: 0 },
    low_stock_threshold: { type: Number, default: 5 },
    supplier:            { type: String, default: '' },
    description:         { type: String, default: '' },
    is_active:           { type: Boolean, default: true },
    shop:                { type: String, default: 'Main Branch' },
  },
  { timestamps: true }
);

// Index for fast search
productSchema.index({ name: 'text', sku_code: 'text' });

module.exports = mongoose.model('Product', productSchema);
