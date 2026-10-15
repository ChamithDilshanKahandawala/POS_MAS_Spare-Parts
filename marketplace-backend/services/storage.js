// Document storage, behind a small interface so this can be swapped for
// real cloud storage (S3 etc.) in Milestone 3 without any caller needing
// to change — they only ever call saveFile()/deleteFile() from this
// module, never touch fs/paths directly.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'seller-applications'); // kept for existing callers

function ensureUploadDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Saves a validated file buffer under a random name (never the client-
// supplied filename, which could contain path-traversal sequences or
// collide with another upload) + the REAL detected extension (not
// whatever the client's filename claimed). `subdir` separates upload
// categories on disk (seller-applications, seller-media, ...) — never
// client-supplied, always one of this module's own constants. Returns
// the path to store on the owning record.
function saveFile(buffer, ext, subdir = 'seller-applications') {
  const dir = path.join(UPLOAD_ROOT, subdir);
  ensureUploadDir(dir);
  const name = `${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(dir, name);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

function readFile(storedPath) {
  return fs.readFileSync(storedPath);
}

function deleteFile(storedPath) {
  if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
}

module.exports = { saveFile, readFile, deleteFile, UPLOAD_DIR };
