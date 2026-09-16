const rateLimit = require('express-rate-limit');

// Slows down brute-force password guessing / credential stuffing against auth
// endpoints. 10 requests per 15 minutes per IP: tight enough to make guessing a
// password impractical, loose enough that a handful of staff mistyping a
// password on the same shop WiFi won't lock each other out.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

// POST /api/sales — an authenticated write hit on every checkout. Keyed by
// user id (not IP) so one busy cashier on shared shop WiFi never blocks a
// different staff member on the same connection. 60/minute is a full sale
// every second sustained — far beyond any realistic manual checkout pace —
// so it only ever catches a runaway loop/bug, not a fast cashier.
const saleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || 'anonymous',
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

// GET /api/products/search — public and unauthenticated (storefront browsing
// plus POS autocomplete-as-you-type), so it needs to tolerate rapid bursts
// from one real visitor typing. 100/minute per IP is generous for that, while
// still stopping a scraping bot from hammering the endpoint.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

// POST /api/products/import and GET /api/products/export — rare, heavy,
// admin-only bulk operations with no legitimate reason to run frequently.
// Same 15-minute window as auth, tighter cap since even a handful of runs
// in a row is unusual.
const bulkOpsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
});

module.exports = { authLimiter, saleLimiter, searchLimiter, bulkOpsLimiter };
