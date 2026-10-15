const Seller = require('../models/Seller');
const { processLogo, processBanner } = require('../services/imageProcessing');
const { saveFile, deleteFile, readFile } = require('../services/storage');
const { logAction } = require('../services/auditLog');

function uploadHandlerFor(field, processFn) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const processed = await processFn(req.file.buffer);
    if (!processed) return res.status(400).json({ message: 'File must be a real JPG, PNG, or WebP image' });

    const seller = await Seller.findById(req.sellerId);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const previousPath = seller[field]?.path;
    const storedPath = saveFile(processed.buffer, processed.ext, 'seller-media');
    seller[field] = { path: storedPath, uploadedAt: new Date() };
    await seller.save();

    if (previousPath) deleteFile(previousPath);

    await logAction({
      actor: req.user,
      actorRole: req.sellerMember.role,
      action: `seller.${field}.update`,
      targetType: 'Seller',
      targetId: seller._id,
      summary: `${req.user.name} updated the store ${field}`,
    });

    res.json({ [field]: seller[field] });
  };
}

// POST /api/seller/me/store/logo, POST /api/seller/me/store/banner —
// real file-type check (magic bytes, not Content-Type/extension),
// resized/compressed and stripped of metadata by services/imageProcessing.js
// before anything touches disk. The old file is deleted only after the
// new one is safely saved and the Seller document updated.
const uploadLogo = uploadHandlerFor('logo', processLogo);
const uploadBanner = uploadHandlerFor('banner', processBanner);

// GET /api/seller/me/store/:field(logo|banner) — streams the raw bytes.
// `path` is never client-supplied, it's looked up on the Seller document
// requireSellerMember has already scoped to, so this can't be used to
// read an arbitrary file off disk.
function getMediaHandlerFor(field) {
  return async (req, res) => {
    const seller = await Seller.findById(req.sellerId).select(field);
    if (!seller || !seller[field]?.path) return res.status(404).json({ message: 'Not found' });
    res.set('Content-Type', 'image/jpeg');
    res.send(readFile(seller[field].path));
  };
}
const getLogo = getMediaHandlerFor('logo');
const getBanner = getMediaHandlerFor('banner');

module.exports = { uploadLogo, uploadBanner, getLogo, getBanner };
