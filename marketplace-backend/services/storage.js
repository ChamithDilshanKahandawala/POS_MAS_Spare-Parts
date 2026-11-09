// File storage behind one small async interface — callers only ever use
// saveFile()/readFile()/deleteFile() and store the returned key.
//
// STORAGE_DRIVER=local (default): files live under uploads/.
// STORAGE_DRIVER=s3: any S3-compatible bucket (AWS S3, Cloudflare R2, …) via
//   S3_BUCKET, S3_REGION, S3_ENDPOINT (R2/MinIO), S3_ACCESS_KEY_ID,
//   S3_SECRET_ACCESS_KEY. The bucket stays private; every read goes through
//   the API, which enforces who may see what (return photos, ID documents).
//
// Keys are "<subdir>/<uuid>.<ext>". Records written before keys existed hold
// an absolute local path; those still read from disk until
// scripts/migrateStorage.js moves them.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'seller-applications'); // kept for existing callers
const SUBDIR_RE = /^[a-z0-9-]+$/;
const KEY_RE = /^[a-z0-9-]+\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

// Resolves a key to a path inside UPLOAD_ROOT, refusing anything that would
// escape it. Legacy absolute paths must also live inside UPLOAD_ROOT.
function localPathFor(stored) {
  const full = path.isAbsolute(stored) ? path.resolve(stored) : path.resolve(UPLOAD_ROOT, stored);
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) throw new Error('Refusing a storage path outside the uploads folder');
  return full;
}

const localDriver = {
  name: 'local',
  async put(key, buffer) {
    const full = localPathFor(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
  },
  async get(key) {
    return fs.promises.readFile(localPathFor(key));
  },
  async remove(key) {
    await fs.promises.rm(localPathFor(key), { force: true });
  },
};

function s3Driver(client = null) {
  // Loaded lazily so local installs never pay for the SDK.
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET must be set when STORAGE_DRIVER=s3');
  const s3 = client || new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
  return {
    name: 's3',
    async put(key, buffer) {
      const ext = key.split('.').pop();
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: CONTENT_TYPES[ext] || 'application/octet-stream' }));
    },
    async get(key) {
      const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await out.Body.transformToByteArray());
    },
    async remove(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

let driver = null;
function activeDriver() {
  if (!driver) driver = process.env.STORAGE_DRIVER === 's3' ? s3Driver() : localDriver;
  return driver;
}

// Tests (and the migration script) can swap the driver; null restores the default.
function setDriverForTests(next) { driver = next; }

const isLegacyPath = (stored) => path.isAbsolute(String(stored));

// Saves a validated buffer under a random name (never the client's filename)
// with the REAL detected extension. `subdir` is always one of the callers'
// own constants. Returns the key to store on the owning record.
async function saveFile(buffer, ext, subdir = 'seller-applications') {
  if (!SUBDIR_RE.test(subdir) || !/^[a-z0-9]{2,5}$/.test(ext)) throw new Error('Invalid storage subdir or extension');
  const key = `${subdir}/${crypto.randomUUID()}.${ext}`;
  await activeDriver().put(key, buffer);
  return key;
}

async function readFile(stored) {
  if (isLegacyPath(stored)) return localDriver.get(stored);
  if (!KEY_RE.test(stored)) throw new Error('Invalid storage key');
  return activeDriver().get(stored);
}

// Never throws for a file that's already gone.
async function deleteFile(stored) {
  if (!stored) return;
  try {
    if (isLegacyPath(stored)) await localDriver.remove(stored);
    else if (KEY_RE.test(stored)) await activeDriver().remove(stored);
  } catch (err) {
    if (err.name !== 'NoSuchKey' && err.code !== 'ENOENT') console.error('[storage] delete failed:', err.message);
  }
}

module.exports = {
  saveFile, readFile, deleteFile, isLegacyPath, s3Driver, localDriver, setDriverForTests, activeDriver,
  UPLOAD_DIR, UPLOAD_ROOT, KEY_RE,
};
