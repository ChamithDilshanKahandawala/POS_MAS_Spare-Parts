const mongoose = require('mongoose');

// Milestone 7 Part B.1 — saved once per courier (owner-only), since each
// courier's remittance export has its own column layout. Column values
// are the exact header text in that courier's file; services/remittance.js
// reads them off the parsed header row rather than assuming any fixed
// position.
const courierColumnMappingSchema = new mongoose.Schema(
  {
    courierName: { type: String, required: true, unique: true, trim: true },
    trackingNumberColumn: { type: String, required: true, trim: true },
    codAmountColumn: { type: String, required: true, trim: true },
    remittanceDateColumn: { type: String, required: true, trim: true },
    referenceColumn: { type: String, required: true, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CourierColumnMapping', courierColumnMappingSchema);
