const mongoose = require('mongoose');

// One uploaded listing photo, processed into three sizes x two formats
// (services/listingImageProcessing.js) — WebP as the primary format,
// JPEG as the universal fallback. `listing` is null for an upload not
// yet attached to a listing (the wizard uploads photos before the
// listing necessarily has an id yet) — scripts/cleanupMedia.js removes
// anything still unattached 24h after creation.
const variantPairSchema = {
  webp: { type: String, required: true },
  jpg: { type: String, required: true },
};

const mediaSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    variants: {
      thumb: variantPairSchema,
      medium: variantPairSchema,
      large: variantPairSchema,
    },
    width: { type: Number, default: null }, // of the large variant
    height: { type: Number, default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ listing: 1 });
mediaSchema.index({ seller: 1, listing: 1, createdAt: 1 }); // scripts/cleanupMedia.js's unused-media sweep

module.exports = mongoose.model('Media', mediaSchema);
