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
const {
  listListings, getListingDetail, createListing, updateListing, checkListingDraft,
  submitListing, hideListing, showListing, deleteListing, duplicateListing, getCommissionPreview,
} = require('../controllers/sellerListingsController');
const { uploadListingMedia, deleteListingMedia, getSellerMediaVariant } = require('../controllers/mediaController');
const { listProducts: listPosProducts, importSelected: importPosProducts, syncNow: syncPosNow, getStatus: getPosStatus } = require('../controllers/sellerPosController');
const { listOrders: listSellerOrders, getOrderDetail: getSellerOrderDetail, transitionOrder, markPosRecorded, markReturnPosRecorded } = require('../controllers/sellerOrdersController');
const {
  listReturns: listSellerReturns,
  getReturn: getSellerReturn,
  respond: respondToReturn,
  received: markReturnReceived,
  getReturnPhoto: getSellerReturnPhoto,
} = require('../controllers/sellerReturnsController');
const { withReturnErrors } = require('../controllers/returnsHttp');
const { STATUSES: RETURN_STATUSES } = require('../models/ReturnRequest');
const {
  getBalances, getLedger, getOrderBreakdown, getStatements, exportStatementCsv, getPayoutHistory,
} = require('../controllers/sellerFinanceController');
const { requireAuth, requireSellerMember } = require('../middleware/authMiddleware');
const requireActiveStore = require('../middleware/requireActiveStore');
const requireFreshStepUp = require('../middleware/requireFreshStepUp');
const { validate, requireValidObjectId } = require('../middleware/validate');
const { upload, handleUploadErrors } = require('../middleware/upload');
const { uploadMedia } = require('../middleware/uploadMedia');
const asyncHandler = require('../middleware/asyncHandler');
const { writeLimiter, uploadLimiter, autosaveLimiter } = require('../middleware/rateLimiter');
const Seller = require('../models/Seller');
const { CONDITIONS, WARRANTY_TYPES } = require('../models/Listing');
const { TYPES: LEDGER_TYPES, STATUSES: LEDGER_STATUSES } = require('../models/LedgerEntry');

const OWNER = ['seller_owner'];
const ANY_MEMBER = ['seller_owner', 'seller_staff'];
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// A broad safety net against hammering any seller write route — keyed by
// user when authenticated, by IP otherwise (middleware/rateLimiter.js).
// Reads are never throttled by this (writeLimiter skips GET/HEAD); the
// step-up and upload routes below additionally get their own tighter
// limiter on top of this one.
router.use(writeLimiter);

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

// --- Listings (Milestone 3) ---
// Deliberately permissive — real business-rule validation (title length,
// prohibited words, required category fields, ...) lives entirely in
// services/listingChecks.js and runs at submit/revision time, never here.
// This schema only enforces shape, so an in-progress autosaved draft is
// never blocked by content it hasn't gotten to yet.
const listingLocalizedZod = z.object({
  en: z.string().max(5000).optional(),
  si: z.string().max(5000).optional(),
  ta: z.string().max(5000).optional(),
}).strict();

const fitmentItemZod = z.object({
  makeId: z.string().regex(OBJECT_ID_RE).nullable().optional(),
  modelName: z.string().trim().max(80).optional(),
  yearFrom: z.number().int().nullable().optional(),
  yearTo: z.number().int().nullable().optional(),
}).strict();

const dimensionsZod = z.object({
  l: z.number().min(0).nullable().optional(),
  w: z.number().min(0).nullable().optional(),
  h: z.number().min(0).nullable().optional(),
}).strict();

const warrantyZod = z.object({
  type: z.enum(WARRANTY_TYPES),
  value: z.number().int().min(0),
}).strict();

const listingBodySchema = z.object({
  title: listingLocalizedZod.optional(),
  description: listingLocalizedZod.optional(),
  categoryId: z.string().regex(OBJECT_ID_RE).optional(),
  brand: z.string().trim().max(120).optional(),
  condition: z.enum(CONDITIONS).optional(),
  sku: z.string().trim().max(60).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  fitment: z.array(fitmentItemZod).max(20).optional(),
  images: z.array(z.string().regex(OBJECT_ID_RE)).max(8).optional(),
  priceCents: z.number().int().min(0).optional(),
  wasPriceCents: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockAlert: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().min(0).optional(),
  dimensions: dimensionsZod.optional(),
  warranty: warrantyZod.optional(),
}).strict();

const createListingBodySchema = z.object({ categoryId: z.string().regex(OBJECT_ID_RE) }).strict();

const listListingsQuerySchema = z.object({
  status: z.enum(['draft', 'in_review', 'published', 'rejected', 'hidden', 'suspended']).optional(),
  needsUpdate: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().regex(OBJECT_ID_RE).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const commissionPreviewQuerySchema = z.object({
  categoryId: z.string().regex(OBJECT_ID_RE),
  priceCents: z.coerce.number().int().min(0),
}).strict();

// id's format is checked by requireValidObjectId (-> 404), registered
// before this on every route that uses it — not re-validated here, just
// passed through so .strict() doesn't reject it as an unknown key.
const mediaVariantParamsSchema = z.object({
  id: z.string(),
  size: z.enum(['thumb', 'medium', 'large']),
  format: z.enum(['webp', 'jpg']),
}).strict();

// --- POS (Milestone 4) ---
const posProductsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  notImported: z.enum(['true', 'false']).optional(),
}).strict();

const posImportBodySchema = z.object({
  posProductIds: z.array(z.string().trim().min(1)).min(1).max(200),
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
  uploadLimiter,
  handleUploadErrors(upload.single('file')),
  asyncHandler(uploadLogo)
);
router.get('/me/store/banner', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getBanner));
router.post(
  '/me/store/banner',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  uploadLimiter,
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

// --- Listings (Milestone 3) ---
// commission-preview and :id/... sub-paths are registered before the
// bare '/:id' routes further down — same ordering lesson as Milestone
// 2's reorder-before-:id (routes/adminRoutes.js).
router.get(
  '/listings/commission-preview',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  validate({ query: commissionPreviewQuerySchema }),
  asyncHandler(getCommissionPreview)
);
router.get('/listings', requireAuth, requireSellerMember(ANY_MEMBER), validate({ query: listListingsQuerySchema }), asyncHandler(listListings));
router.post(
  '/listings',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  validate({ body: createListingBodySchema }),
  asyncHandler(createListing)
);
router.get('/listings/:id', requireAuth, requireSellerMember(ANY_MEMBER), requireValidObjectId('id'), asyncHandler(getListingDetail));
router.patch(
  '/listings/:id',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  autosaveLimiter,
  validate({ body: listingBodySchema }),
  asyncHandler(updateListing)
);
router.delete('/listings/:id', requireAuth, requireSellerMember(ANY_MEMBER), requireActiveStore, requireValidObjectId('id'), asyncHandler(deleteListing));
router.post(
  '/listings/:id/check',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireValidObjectId('id'),
  validate({ body: z.object({}).strict() }),
  asyncHandler(checkListingDraft)
);
router.post(
  '/listings/:id/submit',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: z.object({}).strict() }),
  asyncHandler(submitListing)
);
router.post('/listings/:id/hide', requireAuth, requireSellerMember(ANY_MEMBER), requireActiveStore, requireValidObjectId('id'), asyncHandler(hideListing));
router.post('/listings/:id/show', requireAuth, requireSellerMember(ANY_MEMBER), requireActiveStore, requireValidObjectId('id'), asyncHandler(showListing));
router.post(
  '/listings/:id/duplicate',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  asyncHandler(duplicateListing)
);

// --- Listing media (Milestone 3) ---
router.post(
  '/listings/:id/media',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  uploadLimiter,
  handleUploadErrors(uploadMedia.array('files', 8)),
  asyncHandler(uploadListingMedia)
);
router.delete('/media/:id', requireAuth, requireSellerMember(ANY_MEMBER), requireActiveStore, requireValidObjectId('id'), asyncHandler(deleteListingMedia));
router.get(
  '/media/:id/:size/:format',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireValidObjectId('id'),
  validate({ params: mediaVariantParamsSchema }),
  asyncHandler(getSellerMediaVariant)
);

// --- POS (Milestone 4) ---
// Only visible/usable when the seller's own posConnection.enabled is
// true — loadEnabledSeller (controllers/sellerPosController.js) 404s
// every route below the same way for "disabled" as for "not a member",
// so a non-connected seller can't distinguish the two. /status is the
// one exception: it must work even when disabled, so the console can
// show "off" rather than erroring.
router.get(
  '/pos/products',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  validate({ query: posProductsQuerySchema }),
  asyncHandler(listPosProducts)
);
router.post(
  '/pos/import',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  validate({ body: posImportBodySchema }),
  asyncHandler(importPosProducts)
);
router.post(
  '/pos/sync',
  requireAuth,
  requireSellerMember(OWNER),
  requireActiveStore,
  validate({ body: z.object({}).strict() }),
  asyncHandler(syncPosNow)
);
router.get('/pos/status', requireAuth, requireSellerMember(ANY_MEMBER), asyncHandler(getPosStatus));

// --- Orders (Milestone 6 Part E) ---
const ordersQuerySchema = z.object({
  status: z.enum(['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']).optional(),
  search: z.string().trim().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  // Follow-up — "Not yet recorded in POS": cross-cuts the Shipped/
  // Delivered tabs rather than being its own status value.
  notRecordedInPos: z.enum(['true', 'false']).optional(),
}).strict();

const transitionBodySchema = z.object({
  action: z.enum(['confirm', 'pack', 'ship', 'deliver', 'fail', 'cancel', 'return']),
  reason: z.string().trim().max(300).optional(),
  courier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
}).strict().refine(
  (data) => (data.action !== 'ship' || (data.courier && data.trackingNumber)),
  { message: 'courier and trackingNumber are required to mark an order shipped' }
).refine(
  (data) => (!['cancel', 'fail'].includes(data.action) || !!data.reason),
  { message: 'A reason is required for this action' }
);

router.get('/orders', requireAuth, requireSellerMember(ANY_MEMBER), validate({ query: ordersQuerySchema }), asyncHandler(listSellerOrders));
router.get('/orders/:id', requireAuth, requireSellerMember(ANY_MEMBER), requireValidObjectId('id'), asyncHandler(getSellerOrderDetail));
router.post(
  '/orders/:id/transition',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: transitionBodySchema }),
  asyncHandler(transitionOrder)
);
router.post(
  '/orders/:id/pos-recorded',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: z.object({}).strict() }),
  asyncHandler(markPosRecorded)
);
router.post(
  '/orders/:id/return-pos-recorded',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: z.object({}).strict() }),
  asyncHandler(markReturnPosRecorded)
);

// --- Returns (Milestone 8) — staff can work returns the same way they work orders.
const returnRespondBodySchema = z.object({
  accept: z.boolean(),
  note: z.string().trim().max(1000).optional().default(''),
}).strict().refine((v) => v.accept || v.note.length > 0, { message: 'Give a reason when rejecting a return', path: ['note'] });
const sellerReturnsQuerySchema = z.object({
  status: z.enum(RETURN_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

router.get('/returns', requireAuth, requireSellerMember(ANY_MEMBER), validate({ query: sellerReturnsQuerySchema }), asyncHandler(listSellerReturns));
router.get('/returns/:id', requireAuth, requireSellerMember(ANY_MEMBER), requireValidObjectId('id'), asyncHandler(getSellerReturn));
router.get('/returns/:id/photos/:index', requireAuth, requireSellerMember(ANY_MEMBER), requireValidObjectId('id'), asyncHandler(getSellerReturnPhoto));
router.post(
  '/returns/:id/respond',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: returnRespondBodySchema }),
  asyncHandler(withReturnErrors(respondToReturn))
);
router.post(
  '/returns/:id/received',
  requireAuth,
  requireSellerMember(ANY_MEMBER),
  requireActiveStore,
  requireValidObjectId('id'),
  validate({ body: z.object({}).strict() }),
  asyncHandler(withReturnErrors(markReturnReceived))
);

// --- Finance (Milestone 7 Part D) — owner only, read-only. Staff get a
// flat 403 on every route below (never even a 404-shaped "not found" —
// this is a role gate, not an existence check), per the spec's explicit
// "Seller staff: no access to Finance".
const financeQuerySchema = z.object({
  type: z.enum(LEDGER_TYPES).optional(),
  status: z.enum(LEDGER_STATUSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

router.get('/finance/balances', requireAuth, requireSellerMember(OWNER), asyncHandler(getBalances));
router.get('/finance/ledger', requireAuth, requireSellerMember(OWNER), validate({ query: financeQuerySchema }), asyncHandler(getLedger));
router.get('/finance/orders/:id', requireAuth, requireSellerMember(OWNER), requireValidObjectId('id'), asyncHandler(getOrderBreakdown));
router.get('/finance/statements', requireAuth, requireSellerMember(OWNER), asyncHandler(getStatements));
router.get('/finance/statements/:payoutId/export.csv', requireAuth, requireSellerMember(OWNER), requireValidObjectId('payoutId'), asyncHandler(exportStatementCsv));
router.get('/finance/payouts', requireAuth, requireSellerMember(OWNER), asyncHandler(getPayoutHistory));

module.exports = router;
