const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { getMyStore, ownerOnlyPing, updateMyStore } = require('../controllers/sellerController');
const { getHome } = require('../controllers/sellerHomeController');
const { uploadLogo, uploadBanner, getLogo, getBanner } = require('../controllers/sellerMediaController');
const { stepUpStart, stepUpVerify, getBank, updateBank } = require('../controllers/sellerBankController');
const { listStaff, inviteStaff, removeStaff } = require('../controllers/sellerStaffController');
const { listActivity } = require('../controllers/sellerActivityController');
const { getSellerCategoryTree } = require('../controllers/sellerCatalogController');
const { requireAuth, requireSellerMember } = require('../middleware/authMiddleware');
const requireActiveStore = require('../middleware/requireActiveStore');
const requireFreshStepUp = require('../middleware/requireFreshStepUp');
const { validate, requireValidObjectId } = require('../middleware/validate');
const { upload, handleUploadErrors } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const Seller = require('../models/Seller');

const OWNER = ['seller_owner'];
const ANY_MEMBER = ['seller_owner', 'seller_staff'];

const dayHoursSchema = z.object({
  day: z.enum(Seller.WEEKDAYS),
  closed: z.boolean(),
  open: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')]),
  close: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')]),
}).strict();

// Only the Profile section's fields — never legalName/brNumber/status/
// commissionOverridePct/probationUntil/bankAccount etc., which aren't in
// this schema at all and so are a 400 (unknown field) if sent.
const updateMyStoreSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  aboutText: z.object({
    en: z.string().trim().max(2000).optional(),
    si: z.string().trim().max(2000).optional(),
    ta: z.string().trim().max(2000).optional(),
  }).strict().optional(),
  phones: z.array(z.string().trim().min(5).max(20)).max(3).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional(),
  operatingHours: z.array(dayHoursSchema).max(7).optional(),
  district: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  returnAddress: z.string().trim().optional(),
}).strict();

const stepUpStartSchema = z.object({ password: z.string().min(1) }).strict();
const stepUpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits') }).strict();

const updateBankSchema = z.object({
  bankName: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Account number must be 6-20 digits'),
  reason: z.string().trim().optional(),
}).strict();

const inviteStaffBodySchema = z.object({ email: z.string().trim().toLowerCase().email() }).strict();

const activityQuerySchema = z.object({
  actor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

// Bank step-up shares the login OTP's brute-force concerns — same shape
// of limiter as middleware/rateLimiter.js's authLimiter.
const stepUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.get('/me/store', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getMyStore));
router.patch(
  '/me/store',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  validate({ body: updateMyStoreSchema }),
  asyncHandler(updateMyStore)
);
router.get('/owner-only-test', requireAuth, requireSellerMember(OWNER), asyncHandler(ownerOnlyPing));

router.get('/me/home', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getHome));

// --- Logo / banner ---
router.get('/me/store/logo', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getLogo));
router.post(
  '/me/store/logo',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  handleUploadErrors(upload.single('file')),
  asyncHandler(uploadLogo)
);
router.get('/me/store/banner', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getBanner));
router.post(
  '/me/store/banner',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  handleUploadErrors(upload.single('file')),
  asyncHandler(uploadBanner)
);

// --- Bank account ---
router.post('/bank/step-up', requireAuth, requireSellerMember(OWNER), stepUpLimiter, validate({ body: stepUpStartSchema }), asyncHandler(stepUpStart));
router.post('/bank/step-up/verify', requireAuth, requireSellerMember(OWNER), stepUpLimiter, validate({ body: stepUpVerifySchema }), asyncHandler(stepUpVerify));
router.get('/bank', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getBank));
router.patch(
  '/bank',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  requireFreshStepUp,
  validate({ body: updateBankSchema }),
  asyncHandler(updateBank)
);

// --- Staff (owner only) ---
router.get('/staff', requireAuth, requireSellerMember(OWNER), asyncHandler(listStaff));
router.post(
  '/staff/invite',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  validate({ body: inviteStaffBodySchema }),
  asyncHandler(inviteStaff)
);
router.delete(
  '/staff/:id',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  requireValidObjectId('id'),
  asyncHandler(removeStaff)
);

// --- Activity (read-only) ---
router.get('/activity', requireAuth, requireSellerMember(ANY_MEMBER), validate({ query: activityQuerySchema }), asyncHandler(listActivity));

// --- Catalog (Milestone 2, read-only) ---
router.get('/catalog/categories', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getSellerCategoryTree));

module.exports = router;
