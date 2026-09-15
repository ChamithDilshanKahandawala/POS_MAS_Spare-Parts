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

module.exports = { authLimiter };
