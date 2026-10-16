const sharp = require('sharp');
const { detectFileType } = require('../utils/fileType');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SIZES = { thumb: 200, medium: 600, large: 1200 };
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 85;

// One size, both output formats, from an already-rotated/metadata-free
// sharp pipeline input. WebP is the primary format (console/storefront
// prefer it); JPEG is the universal fallback for anything that can't
// decode WebP.
async function renderSize(pipeline, maxDimension) {
  const resized = pipeline.clone().resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true });
  const [webp, jpg] = await Promise.all([
    resized.clone().webp({ quality: WEBP_QUALITY }).toBuffer(),
    resized.clone().jpeg({ quality: JPEG_QUALITY }).toBuffer(),
  ]);
  return { webp, jpg };
}

// Validates the real file bytes (never the client's claimed type/name),
// auto-rotates per the EXIF orientation tag, then strips ALL metadata —
// GPS included — by never calling .withMetadata() on any output. Returns
// null for anything that isn't a real JPG/PNG/WebP or exceeds the size
// cap; otherwise { thumb, medium, large, width, height }, each of the
// three an { webp, jpg } buffer pair.
async function processListingImage(buffer) {
  if (buffer.length > MAX_UPLOAD_BYTES) return null;
  const detected = detectFileType(buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected.type)) return null;

  const rotated = sharp(buffer).rotate();
  const meta = await rotated.clone().metadata();
  const [thumb, medium, large] = await Promise.all([
    renderSize(rotated, SIZES.thumb),
    renderSize(rotated, SIZES.medium),
    renderSize(rotated, SIZES.large),
  ]);

  return {
    thumb,
    medium,
    large,
    width: meta.width || null,
    height: meta.height || null,
  };
}

module.exports = { processListingImage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, SIZES };
