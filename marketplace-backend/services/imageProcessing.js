const sharp = require('sharp');
const { detectFileType } = require('../utils/fileType');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LOGO_MAX_DIMENSION = 512;
const BANNER_MAX_WIDTH = 1600;
const BANNER_MAX_HEIGHT = 480;
const JPEG_QUALITY = 85;

// Re-encodes everything to JPEG regardless of the source format — one
// predictable output format downstream, and sharp's default .toBuffer()
// (no .withMetadata() call) drops every metadata block from the source,
// EXIF/GPS included, rather than carrying it through. Returns null if the
// real bytes (utils/fileType.js, not the client's claimed type) aren't a
// JPG/PNG/WebP.
async function processImage(buffer, { maxWidth, maxHeight }) {
  const detected = detectFileType(buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected.type)) return null;

  const processed = await sharp(buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { buffer: processed, ext: 'jpg', type: 'image/jpeg' };
}

const processLogo = (buffer) => processImage(buffer, { maxWidth: LOGO_MAX_DIMENSION, maxHeight: LOGO_MAX_DIMENSION });
const processBanner = (buffer) => processImage(buffer, { maxWidth: BANNER_MAX_WIDTH, maxHeight: BANNER_MAX_HEIGHT });

module.exports = { processLogo, processBanner, ALLOWED_IMAGE_TYPES };
