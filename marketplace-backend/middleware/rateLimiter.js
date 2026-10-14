const rateLimit = require('express-rate-limit');

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

module.exports = { authLimiter };
