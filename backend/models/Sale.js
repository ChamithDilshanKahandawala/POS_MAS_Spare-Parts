const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, required: true },
  sku_code: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  buying_price: { type: Number, required: true },
  selling_price: { type: Number, required: true },
  discount: { type: Number, default: 0 }, // discount per item (amount)
  line_total: { type: Number, required: true }, // (selling_price - discount) * quantity
  line_profit: { type: Number, required: true }, // (selling_price - discount - buying_price) * quantity
});

const saleSchema = new mongoose.Schema(
  {
    invoice_number: { type: String, unique: true },
    items: [saleItemSchema],
    subtotal: { type: Number, required: true },
    total_discount: { type: Number, default: 0 }, // bill-level discount (amount)
    total_amount: { type: Number, required: true },
    total_cost: { type: Number, required: true },
    total_profit: { type: Number, required: true },
    payment_method: {
      type: String,
      enum: ['Cash', 'Card', 'Online'],
      default: 'Cash',
    },
    sale_source: {
      type: String,
      enum: ['shop', 'online'],
      default: 'shop',
    },
    customer_name: { type: String, default: 'Walk-in Customer' },
    customer_phone: { type: String, default: '' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order_status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Delivered', // Default to Delivered for POS Shop sales
    },
    tracking_number: { type: String, default: '' },
    shipping_address: { type: String, default: '' },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashier_name: { type: String },
    shop: { type: String, default: 'Main Branch' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate invoice number before saving
saleSchema.pre('save', async function () {
  if (!this.invoice_number) {
    const count = await mongoose.model('Sale').countDocuments();
    const date = new Date();
    const year  = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.invoice_number = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
  // No next() needed — Mongoose 7+ resolves async hooks via the returned Promise
});

module.exports = mongoose.model('Sale', saleSchema);
