const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { submitApplication, getInvite, acceptInvite } = require('../controllers/publicController');
const { getPublicCategoryTree, getPublicVehicles } = require('../controllers/publicCatalogController');
const { listPublicListings, getPublicListingDetail, getRelatedListings } = require('../controllers/publicListingsController');
const { getStorePage, getStoreLogo, getStoreBanner } = require('../controllers/publicStoreController');
const { getPublicMediaVariant } = require('../controllers/mediaController');
const { upload, handleUploadErrors } = require('../middleware/upload');
const { validate, requireValidObjectId } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

// Generous enough for a real applicant filling the form a couple of
// times (typos, re-uploading a document) but not for scripted abuse of
// an unauthenticated, file-accepting endpoint.
const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many applications submitted from this address. Please try again later.' },
});

const inviteAcceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const applicationBodySchema = z.object({
  storeName: z.string().trim().min(1),
  legalName: z.string().trim().min(1),
  brNumber: z.string().trim().min(1),
  ownerName: z.string().trim().min(1),
  nic: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  address: z.string().trim().min(1),
  district: z.string().trim().min(1),
  categories: z.string().optional(),
}).strict();

const acceptInviteParamsSchema = z.object({
  token: z.string().trim().min(1),
}).strict();

const acceptInviteBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  password: z.string().min(8).optional(),
}).strict();

router.post(
  '/seller-applications',
  applicationLimiter,
  handleUploadErrors(upload.fields([
    { name: 'brCertificate', maxCount: 1 },
    { name: 'nicFront', maxCount: 1 },
    { name: 'nicBack', maxCount: 1 },
  ])),
  validate({ body: applicationBodySchema }),
  asyncHandler(submitApplication)
);

router.get(
  '/invites/:token',
  inviteAcceptLimiter,
  validate({ params: acceptInviteParamsSchema }),
  asyncHandler(getInvite)
);

router.post(
  '/invites/:token/accept',
  inviteAcceptLimiter,
  validate({ params: acceptInviteParamsSchema, body: acceptInviteBodySchema }),
  asyncHandler(acceptInvite)
);

// --- Catalog (Milestone 2, public) ---
router.get('/catalog/categories', asyncHandler(getPublicCategoryTree));
router.get('/vehicles', asyncHandler(getPublicVehicles));

// --- Listings (Milestone 3, public read API for Milestone 5) ---
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const listPublicListingsQuerySchema = z.object({
  category: z.string().regex(OBJECT_ID_RE).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  search: z.string().trim().max(200).optional(),
  brand: z.string().trim().max(120).optional(),
  sellerSlug: z.string().trim().max(80).optional(),
  make: z.string().regex(OBJECT_ID_RE).optional(),
  model: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  condition: z.enum(['new', 'used', 'reconditioned']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

const publicMediaParamsSchema = z.object({
  id: z.string(),
  size: z.enum(['thumb', 'medium', 'large']),
  format: z.enum(['webp', 'jpg']),
}).strict();

const storeSlugParamsSchema = z.object({ slug: z.string().trim().min(1) }).strict();

router.get('/listings', validate({ query: listPublicListingsQuerySchema }), asyncHandler(listPublicListings));
router.get('/listings/:id', requireValidObjectId('id'), asyncHandler(getPublicListingDetail));
router.get('/listings/:id/related', requireValidObjectId('id'), asyncHandler(getRelatedListings));
router.get(
  '/media/:id/:size/:format',
  requireValidObjectId('id'),
  validate({ params: publicMediaParamsSchema }),
  asyncHandler(getPublicMediaVariant)
);

// --- Store page (Milestone 5) ---
router.get('/stores/:slug', validate({ params: storeSlugParamsSchema }), asyncHandler(getStorePage));
router.get('/stores/:slug/logo', validate({ params: storeSlugParamsSchema }), asyncHandler(getStoreLogo));
router.get('/stores/:slug/banner', validate({ params: storeSlugParamsSchema }), asyncHandler(getStoreBanner));

module.exports = router;
