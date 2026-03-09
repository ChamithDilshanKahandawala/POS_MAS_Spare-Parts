const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  company_name:        { type: String, required: true, trim: true },
  contact_person:      { type: String, default: '' },
  phone:               { type: String, default: '' },
  email:               { type: String, default: '' },
  address:             { type: String, default: '' },
  outstanding_payment: { type: Number, default: 0 },
  categories:          [{ type: String }],  // e.g. ['Three-Wheel', 'Bike']
  notes:               { type: String, default: '' },
  isActive:            { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
