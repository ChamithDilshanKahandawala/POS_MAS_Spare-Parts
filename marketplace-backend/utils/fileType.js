// Real file-type detection from the first bytes of the buffer (the
// "magic number"/file signature) — never trust the client-supplied
// Content-Type header or the filename's extension, both of which are
// trivially spoofed by just renaming a file (e.g. renaming evil.exe to
// evil.pdf changes neither).
const SIGNATURES = [
  { type: 'application/pdf', ext: 'pdf', check: (b) => b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-' },
  { type: 'image/jpeg', ext: 'jpg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    ext: 'png',
    check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    // RIFF container, "WEBP" at bytes 8-11 — a plain RIFF check alone
    // would also match .wav/.avi, so both are required.
    type: 'image/webp',
    ext: 'webp',
    check: (b) => b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
];

// Returns { type, ext } for the first matching signature, or null if the
// buffer doesn't start with any of PDF/JPG/PNG's real file signature —
// catches a renamed .exe/.html/anything-else regardless of what
// extension or declared mimetype it arrived with.
function detectFileType(buffer) {
  for (const sig of SIGNATURES) {
    if (sig.check(buffer)) return { type: sig.type, ext: sig.ext };
  }
  return null;
}

module.exports = { detectFileType };
