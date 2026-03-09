const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, required: true },
  sku_code:     { type: String },
  quantity:     { type: Number, required: true, min: 1 },
  unit_price:   { type: Number, required: true },
  line_total:   { type: Number, required: true },
});

const returnSchema = new mongoose.Schema({
  return_number: { type: String, unique: true },
  original_sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  invoice_number:{ type: String },
  items:         [returnItemSchema],
  total_refund:  { type: Number, required: true },
  reason:        { type: String, default: '' },
  refund_method: { type: String, enum: ['Cash', 'Card', 'Credit', 'Exchange'], default: 'Cash' },
  processed_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processed_by_name: { type: String },
  stock_restocked: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate return number
returnSchema.pre('save', async function () {
  if (!this.return_number) {
    const count = await mongoose.model('Return').countDocuments();
    const date = new Date();
    const yr  = date.getFullYear().toString().slice(-2);
    const mo  = String(date.getMonth() + 1).padStart(2, '0');
    this.return_number = `RET-${yr}${mo}-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Return', returnSchema);
