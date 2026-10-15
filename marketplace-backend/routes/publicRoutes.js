const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { submitApplication, getInvite, acceptInvite } = require('../controllers/publicController');
const { getPublicCategoryTree, getPublicVehicles } = require('../controllers/publicCatalogController');
const { upload, handleUploadErrors } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
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

module.exports = router;
