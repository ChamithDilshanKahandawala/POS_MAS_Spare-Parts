const multer = require('multer');

// Listing photos: bigger cap than the application-document uploader
// (middleware/upload.js's 5MB/3 files) — up to 8 photos per listing, 8MB
// each (services/listingImageProcessing.js's own MAX_UPLOAD_BYTES is the
// real enforcement on the decoded bytes; this is just multer's own
// pre-check so an oversized request never reaches memory in full).
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 8;

const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

module.exports = { uploadMedia, MAX_FILE_BYTES, MAX_FILES };
