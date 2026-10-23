const express = require('express');
const { z } = require('zod');
const router = express.Router();

const { register, forgotPassword, resetPassword, login, verifyOtp, refresh, logout, getMe } = require('../controllers/authController');
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

// Milestone 5: customer self-registration + forgot/reset password.
// Generic, not seller/customer-specific — same shape authController.js's
// login/verifyOtp already are — but in practice only ever used by the
// storefront, since platform/seller accounts are created through the
// invite-accept flow (routes/publicRoutes.js), never self-registered.
const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^(?:\+94|0)\d{9}$/, 'Enter a valid Sri Lankan phone number'),
  password: z.string().min(8),
}).strict();

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();

const resetPasswordSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
  token: z.string().min(1),
  newPassword: z.string().min(8),
}).strict();

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(register));
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(forgotPassword));
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), asyncHandler(resetPassword));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.post('/verify-otp', authLimiter, validate({ body: verifyOtpSchema }), asyncHandler(verifyOtp));
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), asyncHandler(refresh));
router.post('/logout', requireAuth, asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(getMe));

module.exports = router;
