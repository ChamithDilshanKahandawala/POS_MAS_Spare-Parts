const mongoose = require('mongoose');

// One row per seller per Colombo calendar day, rebuilt by
// services/sellerStats.js. Orders/sales/cancellations are counted on the day
// the order was placed; dispatch on the day it shipped; returns on the day
// they were requested; deliveries on the day they were delivered.
const sellerDailyStatsSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD, Asia/Colombo
    orders: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
    salesCents: { type: Number, default: 0 }, // items total of orders not cancelled
    itemsSold: { type: Number, default: 0 },
    shipped: { type: Number, default: 0 },
    shippedOnTime: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    returnRequests: { type: Number, default: 0 },
    listings: [{
      _id: false,
      listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
      title: { type: String, default: '' },
      qty: { type: Number, default: 0 },
      salesCents: { type: Number, default: 0 },
    }],
  },
  { timestamps: true }
);

sellerDailyStatsSchema.index({ seller: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('SellerDailyStats', sellerDailyStatsSchema);
