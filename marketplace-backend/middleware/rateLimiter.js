const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { verifyAccessToken } = require('../services/tokens');

// Same reasoning as backend/middleware/rateLimiter.js's authLimiter: tight
// enough to make credential/OTP guessing impractical, loose enough that a
// handful of mistyped attempts on shared office WiFi doesn't lock
// everyone out together. Shared across /login, /verify-otp and /refresh
// (one bucket per IP, not per route) — in NODE_ENV=test that one shared
// bucket would otherwise cap an entire automated test run at 10 requests
// total across every persona, which tests brute-force protection by
// accident rather than on purpose. Relaxed only for NODE_ENV=test; dev
// and production both get the real limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Keys a limiter by the authenticated user when there is one, falling
// back to IP otherwise — so one person can't dodge a limit by rotating
// IPs, and several legitimate users behind the same office/NAT IP don't
// share one budget. Reuses the same JWT verify requireAuth itself uses,
// but deliberately never touches the database (a 401 here would be
// wrong anyway — an invalid/expired token just falls back to IP, same
// as no token at all; requireAuth is still what actually rejects it).
//
// The IP fallback goes through express-rate-limit's own ipKeyGenerator
// rather than using req.ip directly — an IPv6 address has many
// textually-different representations of the same address, so keying
// on the raw string would let an IPv6 client dodge the limit just by
// varying how it writes its own address.
function keyByUserOrIp(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = verifyAccessToken(authHeader.slice(7));
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Falls through to IP — an invalid token is requireAuth's problem,
      // not this limiter's.
    }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

// The listing wizard's own autosave route (PATCH /seller/listings/:id)
// fires on every step change AND on a 3s typing pause — a seller
// actively editing can legitimately send far more than 120 writes in 15
// minutes without doing anything wrong. writeLimiter skips it entirely
// (below) so it's governed only by autosaveLimiter's own, higher cap.
const AUTOSAVE_ROUTE_RE = /^\/listings\/[0-9a-fA-F]{24}$/;
const isAutosaveRoute = (req) => req.method === 'PATCH' && AUTOSAVE_ROUTE_RE.test(req.path);

const WRITE_LIMIT_MAX = 120;
const AUTOSAVE_LIMIT_MAX = 600;

// Mounted once per router (router.use) ahead of every route — a broad
// safety net against hammering any admin/seller write route, not a
// replacement for the tighter, route-specific limiters below (uploads,
// step-up, autosave) which still apply on top of this one. Reads
// (GET/HEAD) are never throttled by this; only mutating requests count
// against it. The autosave route is excluded here — see
// isAutosaveRoute above — and governed by autosaveLimiter instead.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : WRITE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || isAutosaveRoute(req),
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

// Tighter than writeLimiter — each request here costs real disk + CPU
// (sharp processing 3 sizes x 2 formats per image), not just a DB write.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
});

// Looser than writeLimiter, specifically for the autosave route — see
// isAutosaveRoute's comment above for why it needs its own, higher cap.
const autosaveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : AUTOSAVE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { message: 'Too many saves in a short time. Please wait a moment and try again.' },
});

module.exports = {
  authLimiter, writeLimiter, uploadLimiter, autosaveLimiter, keyByUserOrIp,
  WRITE_LIMIT_MAX, AUTOSAVE_LIMIT_MAX,
};
