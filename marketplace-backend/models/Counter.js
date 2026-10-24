const mongoose = require('mongoose');

// Generic atomic-sequence counter — _id is a scope key (e.g. "order-2602"
// for an order number sequence scoped to year-month 2026-02), seq is the
// last value issued under that key. services/orderNumbers.js is the only
// thing that reads/writes this; it always goes through a single atomic
// findOneAndUpdate($inc, upsert:true), which is what makes two concurrent
// checkouts in the same month get two different numbers even without a
// transaction (a single document update is already atomic in MongoDB).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
