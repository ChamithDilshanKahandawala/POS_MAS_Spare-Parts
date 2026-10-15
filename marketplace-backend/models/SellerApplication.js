const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true }, // snapshot — survives the author's name changing later
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const documentSchema = new mongoose.Schema({
  type: { type: String, enum: ['br_certificate', 'nic_front', 'nic_back'], required: true },
  filename: { type: String, required: true }, // original filename, display only
  path: { type: String, required: true }, // on-disk path under the local dev upload dir
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// A prospective seller's public submission. Status is the review queue's
// own state machine (new -> info_requested -> approved/rejected) — not
// the same as Seller.status, which only exists once an application is
// approved and a real Seller document is created from it.
const sellerApplicationSchema = new mongoose.Schema(
  {
    storeName: { type: String, required: true, trim: true },
    legalName: { type: String, required: true, trim: true },
    brNumber: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    nic: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    categories: { type: [String], default: [] },
    documents: { type: [documentSchema], default: [] },

    status: { type: String, enum: ['new', 'info_requested', 'approved', 'rejected'], default: 'new' },
    checklist: {
      brVerified: { type: Boolean, default: false },
      nicVerified: { type: Boolean, default: false },
      phoneCalled: { type: Boolean, default: false },
      addressChecked: { type: Boolean, default: false },
    },
    notes: { type: [noteSchema], default: [] },

    infoRequestedMessage: { type: String, default: '' },
    rejectedReason: { type: String, default: '' },
    approvedSeller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellerApplication', sellerApplicationSchema);
