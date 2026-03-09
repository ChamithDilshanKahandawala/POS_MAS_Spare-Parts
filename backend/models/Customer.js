const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, default: '', trim: true },
  email:        { type: String, default: '' },
  address:      { type: String, default: '' },
  vehicle_plate:{ type: String, default: '', uppercase: true, trim: true },
  vehicle_type: { type: String, enum: ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road', 'Other'], default: 'Other' },
  credit_limit: { type: Number, default: 0 },
  balance_due:  { type: Number, default: 0 },  // outstanding credit
  discount_pct: { type: Number, default: 0 },  // % discount for this customer
  notes:        { type: String, default: '' },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
