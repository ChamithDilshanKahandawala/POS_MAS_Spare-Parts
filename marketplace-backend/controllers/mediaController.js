const Media = require('../models/Media');
const Listing = require('../models/Listing');
const { processListingImage } = require('../services/listingImageProcessing');
const { saveFile, deleteFile, readFile } = require('../services/storage');

const MEDIA_SUBDIR = 'listing-media';

// POST /api/seller/listings/:id/media — uploads 1-8 photos for this
// listing. Deliberately does NOT touch listing.images itself — the
// wizard's Photos step attaches/reorders/removes by PATCHing the
// listing's own `images` array (controllers/sellerListingsController.js),
// which also doubles as the one place that enforces "never another
// seller's media" (every id in that array must resolve to Media this
// seller owns). All-or-nothing: if any file in the batch fails the real
// magic-byte/size check, nothing in the batch is saved.
const uploadListingMedia = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

  const processed = await Promise.all(files.map((f) => processListingImage(f.buffer)));
  const failedIndex = processed.findIndex((p) => !p);
  if (failedIndex >= 0) {
    return res.status(400).json({ message: `File ${failedIndex + 1} must be a real JPG, PNG, or WebP image under 8MB` });
  }

  const created = await Promise.all(processed.map(async (p) => {
    const variants = {};
    for (const size of ['thumb', 'medium', 'large']) {
      variants[size] = {
        webp: saveFile(p[size].webp, 'webp', MEDIA_SUBDIR),
        jpg: saveFile(p[size].jpg, 'jpg', MEDIA_SUBDIR),
      };
    }
    return Media.create({ seller: req.sellerId, listing: listing._id, variants, width: p.width, height: p.height });
  }));

  res.status(201).json({ media: created });
};

// DELETE /api/seller/media/:id — permanent. Also strips it from any
// listing.images array still pointing at it, so a stale reference never
// lingers after the files are gone.
const deleteListingMedia = async (req, res) => {
  const media = await Media.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!media) return res.status(404).json({ message: 'Media not found' });

  if (media.listing) {
    await Listing.updateOne({ _id: media.listing }, { $pull: { images: media._id } });
  }

  for (const size of ['thumb', 'medium', 'large']) {
    deleteFile(media.variants[size].webp);
    deleteFile(media.variants[size].jpg);
  }
  await media.deleteOne();

  res.json({ message: 'Deleted' });
};

const CONTENT_TYPES = { webp: 'image/webp', jpg: 'image/jpeg' };
const VALID_SIZES = ['thumb', 'medium', 'large'];

function streamVariant(media, size, format, res) {
  if (!VALID_SIZES.includes(size) || !CONTENT_TYPES[format]) return res.status(404).json({ message: 'Not found' });
  const storedPath = media.variants?.[size]?.[format];
  if (!storedPath) return res.status(404).json({ message: 'Not found' });
  res.set('Content-Type', CONTENT_TYPES[format]);
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(readFile(storedPath));
}

// GET /api/seller/media/:id/:size/:format — own media only.
const getSellerMediaVariant = async (req, res) => {
  const media = await Media.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!media) return res.status(404).json({ message: 'Not found' });
  streamVariant(media, req.params.size, req.params.format, res);
};

// GET /api/admin/listings/media/:id/:size/:format — any seller's media,
// platform staff reviewing a listing need to see the real photos
// regardless of who uploaded them.
const getAdminMediaVariant = async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) return res.status(404).json({ message: 'Not found' });
  streamVariant(media, req.params.size, req.params.format, res);
};

// GET /api/public/media/:id/:size/:format — only ever serves a photo
// that's actually in a currently PUBLISHED listing's own, LIVE `images`
// array (the public visibility rule Part E's listing routes also
// enforce) — a draft's or a pending revision's new photos are never
// reachable here even if the id leaks: a photo uploaded as part of a
// pending revision has `media.listing` set (sellerListingsController.js's
// update) but isn't in the listing's live `images` array until the
// revision is approved, so the `images: media._id` check below is what
// actually excludes it, not just the listing's status.
const getPublicMediaVariant = async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media || !media.listing) return res.status(404).json({ message: 'Not found' });
  const listing = await Listing.findOne({ _id: media.listing, status: 'published', images: media._id }).select('_id');
  if (!listing) return res.status(404).json({ message: 'Not found' });
  streamVariant(media, req.params.size, req.params.format, res);
};

module.exports = {
  uploadListingMedia,
  deleteListingMedia,
  getSellerMediaVariant,
  getAdminMediaVariant,
  getPublicMediaVariant,
};
