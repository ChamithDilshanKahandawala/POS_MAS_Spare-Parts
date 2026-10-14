const express = require('express');
const { z } = require('zod');
const router = express.Router();

const { login, verifyOtp, refresh, logout, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

// .strict() on every body schema: an unknown field (e.g. a client trying
// to slip `platformRole` or `status` into a login/signup-shaped request)
// is a 400, not a silently-dropped field — see middleware/validate.js.
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
}).strict();

const verifyOtpSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
}).strict();

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict();

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.post('/verify-otp', authLimiter, validate({ body: verifyOtpSchema }), asyncHandler(verifyOtp));
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), asyncHandler(refresh));
router.post('/logout', requireAuth, asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(getMe));

module.exports = router;
