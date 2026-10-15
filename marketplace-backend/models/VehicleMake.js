const mongoose = require('mongoose');

const VEHICLE_TYPES = ['car', 'van', 'suv', 'motorcycle', 'three_wheeler', 'lorry', 'bus'];

const vehicleModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  yearFrom: { type: Number, default: null },
  yearTo: { type: Number, default: null }, // null = still in production / unknown end year
  active: { type: Boolean, default: true },
}, { _id: true });

// Reference data for fitment-type attribute fields (models/Category.js's
// attributeSchema, type: 'fitment') — Milestone 3's listing form reads
// this to populate make/model/year pickers. Not seller- or
// category-scoped; one shared list for the whole platform.
const vehicleMakeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    active: { type: Boolean, default: true },
    models: { type: [vehicleModelSchema], default: [] },
  },
  { timestamps: true }
);

vehicleMakeSchema.index({ name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('VehicleMake', vehicleMakeSchema);
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
