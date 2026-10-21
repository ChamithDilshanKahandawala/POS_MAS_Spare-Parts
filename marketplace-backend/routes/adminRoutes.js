const express = require('express');
const { z } = require('zod');
const router = express.Router();

const {
  listSellers,
  getSellerDetail,
  updateSellerStatus,
  updateSellerOverrides,
  viewAsSeller,
  getSellerBank,
  verifySellerBank,
  rejectSellerBank,
  TRANSITIONS,
} = require('../controllers/adminSellersController');
const { getOverview } = require('../controllers/overviewController');
const {
  listApplications,
  getApplicationDetail,
  getApplicationDocument,
  updateChecklist,
  addNote,
  requestInfo,
  approveApplication,
  rejectApplication,
} = require('../controllers/applicationsController');
const { listPlatformStaff, inviteStaff, changeRole, removeStaff } = require('../controllers/platformStaffController');
const { listAuditLog, exportAuditLogCsv } = require('../controllers/auditLogController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const {
  getCategoryTree,
  getCategoryDetail,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} = require('../controllers/adminCategoriesController');
const { listMakes, createMake, updateMake } = require('../controllers/adminVehiclesController');
const {
  listReviewQueue, getReviewDetail, approveListing, rejectListing, suspendListing, reinstateListing,
} = require('../controllers/adminListingsController');
const { getAdminMediaVariant } = require('../controllers/mediaController');
const { getPosStatus, updatePosConnection } = require('../controllers/adminPosController');
const { requireAuth, requirePlatform } = require('../middleware/authMiddleware');
const { validate, requireValidObjectId } = require('../middleware/validate');
const restrictFieldsToOwner = require('../middleware/restrictFieldsToOwner');
const asyncHandler = require('../middleware/asyncHandler');
const { writeLimiter } = require('../middleware/rateLimiter');
const { FIELD_TYPES } = require('../models/Category');
const { VEHICLE_TYPES } = require('../models/VehicleMake');
const { REJECTION_REASONS } = require('../models/Listing');

const PLATFORM_ROLES = ['platform_owner', 'platform_staff'];
const OWNER_ONLY = ['platform_owner'];

// A broad safety net against hammering any admin write route — keyed by
// user when authenticated, by IP otherwise (middleware/rateLimiter.js).
// Reads are never throttled by this (writeLimiter skips GET/HEAD).
router.use(writeLimiter);

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// A malformed id in the URL is handled by requireValidObjectId (404,
// registered per-route below) — none of these body/query schemas
// validate `id` themselves, so there's exactly one place that decides
// what a bad id means.
const DOCUMENT_TYPES = ['br_certificate', 'nic_front', 'nic_back'];

const listSellersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['in_review', 'active', 'suspended', 'closed']).optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const updateStatusBodySchema = z.object({
  action: z.enum(Object.keys(TRANSITIONS)),
  reason: z.string().trim().min(1, 'Reason is required'),
}).strict();

const updateOverridesBodySchema = z.object({
  commissionOverridePct: z.number().min(0).max(100).nullable().optional(),
  probationUntil: z.string().datetime().nullable().optional(),
  reviewExempt: z.boolean().optional(),
  reason: z.string().trim().min(1, 'Reason is required'),
}).strict();

// --- POS connection (Milestone 4) ---
const updatePosConnectionBodySchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().url().optional(),
  integrationKey: z.string().trim().min(8).optional(),
  reason: z.string().trim().min(1, 'Reason is required'),
}).strict();

const applicationsQuerySchema = z.object({
  status: z.enum(['new', 'info_requested', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const checklistBodySchema = z.object({
  brVerified: z.boolean().optional(),
  nicVerified: z.boolean().optional(),
  phoneCalled: z.boolean().optional(),
  addressChecked: z.boolean().optional(),
}).strict();

const noteBodySchema = z.object({
  text: z.string().trim().min(1, 'Note text is required'),
}).strict();

const requestInfoBodySchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
}).strict();

const rejectBodySchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required'),
}).strict();

const emptyBodySchema = z.object({}).strict();

const inviteStaffBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();

const changeRoleBodySchema = z.object({
  role: z.enum(['none', 'platform_staff']),
}).strict();

const auditLogQuerySchema = z.object({
  actor: z.string().regex(OBJECT_ID_RE).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const updateSettingsBodySchema = z.object({
  defaultReturnWindowDays: z.number().int().min(0).optional(),
  payoutDayOfWeek: z.number().int().min(0).max(6).optional(),
  payoutHoldDays: z.number().int().min(0).optional(),
  reviewRequiredForFirstNListings: z.number().int().min(0).optional(),
  supportPhone: z.string().optional(),
  supportEmail: z.string().optional(),
  supportWhatsapp: z.string().optional(),
  prohibitedKeywords: z.array(z.string().trim().min(1)).optional(),
}).strict();

// --- Catalog: categories ---

const localizedZod = (requireEn = false) => z.object({
  en: requireEn ? z.string().trim().min(1) : z.string().trim().optional(),
  si: z.string().trim().optional(),
  ta: z.string().trim().optional(),
}).strict();

const fieldOptionZod = z.object({
  value: z.string().trim().min(1),
  label: localizedZod(true),
}).strict();

// `_id` is how a field update is told apart from a field removal +
// addition (controllers/adminCategoriesController.js's rename guard) —
// optional because a brand-new field the console sends has none yet.
const attributeFieldZod = z.object({
  _id: z.string().regex(OBJECT_ID_RE).optional(),
  key: z.string().trim().min(1).max(60).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must start with a letter and contain only letters, numbers, and underscores'),
  label: localizedZod(true),
  helpText: localizedZod().optional(),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(fieldOptionZod).optional(),
  unit: z.string().optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  maxLength: z.number().int().positive().nullable().optional(),
  showOnProductPage: z.boolean().optional(),
  filterable: z.boolean().optional(),
}).strict();

const returnPolicyZod = z.object({
  returnable: z.boolean().nullable().optional(),
  windowDays: z.number().int().min(0).nullable().optional(),
  note: localizedZod().optional(),
}).strict();

const warrantyRuleZod = z.object({
  minMonths: z.number().int().min(0).nullable().optional(),
}).strict();

const slugZod = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only');

const createCategoryBodySchema = z.object({
  name: localizedZod(true),
  slug: slugZod,
  parentId: z.string().regex(OBJECT_ID_RE).nullable().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  commissionRateBps: z.number().int().min(0).max(5000).optional(),
  returnPolicy: returnPolicyZod.optional(),
  warrantyRule: warrantyRuleZod.optional(),
  regulated: z.boolean().nullable().optional(),
  reviewRequired: z.boolean().nullable().optional(),
  prohibitedKeywords: z.array(z.string().trim().min(1)).optional(),
  attributeSchema: z.array(attributeFieldZod).optional(),
}).strict();

const updateCategoryBodySchema = createCategoryBodySchema.partial();

const reorderCategoriesBodySchema = z.object({
  parentId: z.string().regex(OBJECT_ID_RE).nullable(),
  orderedIds: z.array(z.string().regex(OBJECT_ID_RE)).min(1),
}).strict();

// --- Listings (Milestone 3) ---

const listingQueueQuerySchema = z.object({
  seller: z.string().regex(OBJECT_ID_RE).optional(),
  category: z.string().regex(OBJECT_ID_RE).optional(),
  type: z.enum(['new', 'revision']).optional(),
  regulated: z.enum(['true', 'false']).optional(),
  status: z.enum(['all', 'draft', 'in_review', 'published', 'rejected', 'hidden', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const rejectListingBodySchema = z.object({
  reasons: z.array(z.enum(REJECTION_REASONS)).min(1, 'At least one reason is required'),
  note: z.string().trim().max(2000).optional(),
}).strict();

const suspendListingBodySchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required'),
}).strict();

const reinstateListingBodySchema = z.object({
  to: z.enum(['published', 'hidden']),
}).strict();

const adminMediaParamsSchema = z.object({
  id: z.string(),
  size: z.enum(['thumb', 'medium', 'large']),
  format: z.enum(['webp', 'jpg']),
}).strict();

// --- Catalog: vehicles ---

const vehicleModelZod = z.object({
  _id: z.string().regex(OBJECT_ID_RE).optional(),
  name: z.string().trim().min(1),
  yearFrom: z.number().int().nullable().optional(),
  yearTo: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
}).strict();

const createMakeBodySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(VEHICLE_TYPES),
  active: z.boolean().optional(),
  models: z.array(vehicleModelZod).optional(),
}).strict();

const updateMakeBodySchema = createMakeBodySchema.partial();

const listMakesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

// Not a malformed-id case (requireValidObjectId handles that) — just an
// unrecognized document type, a plain 400.
function requireValidDocumentType(req, res, next) {
  if (!DOCUMENT_TYPES.includes(req.params.type)) {
    return res.status(400).json({ message: 'Invalid document type' });
  }
  return next();
}

router.get('/overview', requireAuth, requirePlatform(PLATFORM_ROLES), asyncHandler(getOverview));

router.get(
  '/sellers',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: listSellersQuerySchema }),
  asyncHandler(listSellers)
);
router.get(
  '/sellers/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getSellerDetail)
);
router.patch(
  '/sellers/:id/status',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: updateStatusBodySchema }),
  asyncHandler(updateSellerStatus)
);
router.patch(
  '/sellers/:id/overrides',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  requireValidObjectId('id'),
  validate({ body: updateOverridesBodySchema }),
  asyncHandler(updateSellerOverrides)
);
router.post(
  '/sellers/:id/view-as',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(viewAsSeller)
);

// --- POS connection (Milestone 4) ---
router.get(
  '/sellers/:id/pos',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getPosStatus)
);
router.patch(
  '/sellers/:id/pos',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  requireValidObjectId('id'),
  validate({ body: updatePosConnectionBodySchema }),
  asyncHandler(updatePosConnection)
);

// --- Bank verification (Milestone 1B) ---
router.get(
  '/sellers/:id/bank',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getSellerBank)
);
router.patch(
  '/sellers/:id/bank/verify',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: emptyBodySchema }),
  asyncHandler(verifySellerBank)
);
router.patch(
  '/sellers/:id/bank/reject',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: rejectBodySchema }),
  asyncHandler(rejectSellerBank)
);

// --- Applications ---
router.get(
  '/applications',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: applicationsQuerySchema }),
  asyncHandler(listApplications)
);
router.get(
  '/applications/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getApplicationDetail)
);
router.get(
  '/applications/:id/documents/:type',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  requireValidDocumentType,
  asyncHandler(getApplicationDocument)
);
router.patch(
  '/applications/:id/checklist',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: checklistBodySchema }),
  asyncHandler(updateChecklist)
);
router.post(
  '/applications/:id/notes',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: noteBodySchema }),
  asyncHandler(addNote)
);
router.post(
  '/applications/:id/request-info',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: requestInfoBodySchema }),
  asyncHandler(requestInfo)
);
router.post(
  '/applications/:id/approve',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: emptyBodySchema }),
  asyncHandler(approveApplication)
);
router.post(
  '/applications/:id/reject',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: rejectBodySchema }),
  asyncHandler(rejectApplication)
);

// --- Platform staff (owner only) ---
router.get('/platform-staff', requireAuth, requirePlatform(OWNER_ONLY), asyncHandler(listPlatformStaff));
router.post(
  '/platform-staff/invite',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  validate({ body: inviteStaffBodySchema }),
  asyncHandler(inviteStaff)
);
router.patch(
  '/platform-staff/:id/role',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  requireValidObjectId('id'),
  validate({ body: changeRoleBodySchema }),
  asyncHandler(changeRole)
);
router.delete(
  '/platform-staff/:id',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  requireValidObjectId('id'),
  asyncHandler(removeStaff)
);

// --- Audit log (read-only — no edit/delete route exists) ---
router.get(
  '/audit-log',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: auditLogQuerySchema }),
  asyncHandler(listAuditLog)
);
router.get(
  '/audit-log/export.csv',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: auditLogQuerySchema }),
  asyncHandler(exportAuditLogCsv)
);

// --- Settings ---
router.get('/settings', requireAuth, requirePlatform(PLATFORM_ROLES), asyncHandler(getSettings));
router.patch(
  '/settings',
  requireAuth,
  requirePlatform(OWNER_ONLY),
  validate({ body: updateSettingsBodySchema }),
  asyncHandler(updateSettings)
);

// --- Catalog: categories (Milestone 2) ---
// commissionRateBps/regulated/reviewRequired are owner-only on both
// create and update — restrictFieldsToOwner runs after validate() so it
// only ever inspects a body that's already known to be well-formed.
const OWNER_ONLY_CATEGORY_FIELDS = ['commissionRateBps', 'regulated', 'reviewRequired'];

router.get('/catalog/categories', requireAuth, requirePlatform(PLATFORM_ROLES), asyncHandler(getCategoryTree));
router.get(
  '/catalog/categories/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getCategoryDetail)
);
router.post(
  '/catalog/categories',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ body: createCategoryBodySchema }),
  restrictFieldsToOwner(OWNER_ONLY_CATEGORY_FIELDS),
  asyncHandler(createCategory)
);
router.patch(
  '/catalog/categories/reorder',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ body: reorderCategoriesBodySchema }),
  asyncHandler(reorderCategories)
);
router.patch(
  '/catalog/categories/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: updateCategoryBodySchema }),
  restrictFieldsToOwner(OWNER_ONLY_CATEGORY_FIELDS),
  asyncHandler(updateCategory)
);
router.delete(
  '/catalog/categories/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(deleteCategory)
);

// --- Listings (Milestone 3) ---
router.get(
  '/listings',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: listingQueueQuerySchema }),
  asyncHandler(listReviewQueue)
);
router.get(
  '/listings/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  asyncHandler(getReviewDetail)
);
router.post(
  '/listings/:id/approve',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: emptyBodySchema }),
  asyncHandler(approveListing)
);
router.post(
  '/listings/:id/reject',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: rejectListingBodySchema }),
  asyncHandler(rejectListing)
);
router.post(
  '/listings/:id/suspend',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: suspendListingBodySchema }),
  asyncHandler(suspendListing)
);
router.post(
  '/listings/:id/reinstate',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: reinstateListingBodySchema }),
  asyncHandler(reinstateListing)
);
router.get(
  '/listings/media/:id/:size/:format',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ params: adminMediaParamsSchema }),
  asyncHandler(getAdminMediaVariant)
);

// --- Catalog: vehicles (Milestone 2) ---
router.get(
  '/vehicles',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ query: listMakesQuerySchema }),
  asyncHandler(listMakes)
);
router.post(
  '/vehicles',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ body: createMakeBodySchema }),
  asyncHandler(createMake)
);
router.patch(
  '/vehicles/:id',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  requireValidObjectId('id'),
  validate({ body: updateMakeBodySchema }),
  asyncHandler(updateMake)
);

module.exports = router;
