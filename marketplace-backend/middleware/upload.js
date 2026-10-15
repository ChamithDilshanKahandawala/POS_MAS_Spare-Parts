const multer = require('multer');

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

// Buffered in memory (not disk) — detectFileType() needs the bytes
// before any decision is made about where/whether to persist them, and
// an application upload is small (3 files, 5MB cap each) so this is
// never a real memory concern.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 3 },
});

// multer's own errors (file too large, too many files, ...) would
// otherwise reach server.js's generic error handler as an uncategorized
// 500 — this turns them into the 400 they actually are. Wrap
// upload.fields(...) with this in every route that uses it.
function handleUploadErrors(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      if (err) return next(err);
      return next();
    });
  };
}

module.exports = { upload, MAX_FILE_BYTES, handleUploadErrors };
