const mongoose = require('mongoose');

const KINDS = ['page', 'banner', 'announcement'];
const PAGE_SLUGS = ['about', 'delivery', 'returns', 'terms', 'privacy'];
const BANNER_LANGUAGES = ['all', 'en', 'si', 'ta'];

const localized = {
  en: { type: String, default: '' },
  si: { type: String, default: '' },
  ta: { type: String, default: '' },
};

// Everything editable a block can hold; which fields matter depends on kind:
// page -> title, body; announcement -> text, link, window; banner -> title
// (headline + alt text), link, language, window, imagePath.
const versionSchema = new mongoose.Schema({
  title: localized,
  body: localized,
  text: localized,
  link: { type: String, default: '' },
  language: { type: String, enum: BANNER_LANGUAGES, default: 'all' },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  imagePath: { type: String, default: null },
}, { _id: false });

// Admin → Content. Staff edit `draft`; publishing copies it to `published`,
// which is the only thing the storefront ever reads.
const contentBlockSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: KINDS, required: true },
    key: { type: String, required: true }, // page slug, 'announcement', or a banner's own id
    sortOrder: { type: Number, default: 0 },
    draft: { type: versionSchema, default: () => ({}) },
    published: { type: versionSchema, default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    draftUpdatedAt: { type: Date, default: () => new Date() },
    draftUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

contentBlockSchema.index({ kind: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('ContentBlock', contentBlockSchema);
module.exports.KINDS = KINDS;
module.exports.PAGE_SLUGS = PAGE_SLUGS;
module.exports.BANNER_LANGUAGES = BANNER_LANGUAGES;
