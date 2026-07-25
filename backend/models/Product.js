const mongoose = require('mongoose');
const { buildProductSearchDocument } = require('../utils/productSearch');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku_code: { type: String, required: true, unique: true, uppercase: true },
    barcode: { type: String, default: '', trim: true },
    brand: { type: String, default: '', trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road', 'KeyTag', 'Toys', 'Ornaments', 'Electronics','Company Item'],
    },
    sub_category:        { type: String, default: '' },
    unit:                { type: String, enum: ['Units', 'Liters', 'Packets', 'Meters', 'Sets', 'Pairs', 'Kg'], default: 'Units' },
    buying_price:        { type: Number, required: true, min: 0 },
    selling_price:       { type: Number, required: true, min: 0 },
    stock_quantity:      { type: Number, required: true, default: 0, min: 0 },
    low_stock_threshold: { type: Number, default: 5 },
    supplier:            { type: String, default: '' },
    description:         { type: String, default: '' },
    tags:                [{ type: String, trim: true }],
    search_text:         { type: String, default: '' },
    search_terms:        [{ type: String }],
    search_ngrams:       [{ type: String }],
    is_active:           { type: Boolean, default: true },
    shop:                { type: String, default: 'Main Branch' },
  },
  { timestamps: true }
);

// Indexes for smart inventory search.
productSchema.index({ is_active: 1, category: 1, updatedAt: -1 });
productSchema.index({ search_terms: 1 });
productSchema.index({ search_ngrams: 1 });
productSchema.index(
  {
    name: 'text',
    sku_code: 'text',
    barcode: 'text',
    brand: 'text',
    category: 'text',
    sub_category: 'text',
    description: 'text',
    tags: 'text',
  },
  {
    name: 'product_inventory_text_search',
    weights: {
      name: 10,
      sku_code: 9,
      barcode: 8,
      brand: 6,
      category: 5,
      sub_category: 4,
      tags: 4,
      description: 2,
    },
  },
);

productSchema.pre('save', function (next) {
  const searchDoc = buildProductSearchDocument(this);
  this.search_text = searchDoc.search_text;
  this.search_terms = searchDoc.search_terms;
  this.search_ngrams = searchDoc.search_ngrams;
  this.tags = searchDoc.tags;
  next();
});

module.exports = mongoose.model('Product', productSchema);
