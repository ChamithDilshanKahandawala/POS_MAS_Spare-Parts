const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer' },
    status:   { type: String, enum: ['pending', 'active', 'rejected'], default: 'active' }, // Default active for customers, pending logic handled in registration
    shop:     { type: String, default: 'Main Branch' },
    isActive: { type: Boolean, default: true }, // Default true for customers
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sale' }],
  },
  { timestamps: true }
);

// Pre-save hook to set defaults based on role if needed
userSchema.pre('save', function (next) {
  if (this.isNew && this.role === 'staff') {
    if (this.status === 'active') this.status = 'pending';
    if (this.isActive === true) this.isActive = false;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
