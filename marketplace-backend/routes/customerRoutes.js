const express = require('express');
const { z } = require('zod');
const router = express.Router();

const {
  getProfile, updateProfile,
  listAddresses, createAddress, updateAddress, deleteAddress,
  listVehicles, createVehicle, deleteVehicle,
} = require('../controllers/customerController');
const { requireAuth } = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimiter');
const { validate, requireValidObjectId } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { SRI_LANKA_DISTRICTS } = require('../utils/sriLankaDistricts');

// Any authenticated User — there is no platform/seller gate here, same
// reasoning as GET /api/auth/me: this is account self-service, scoped
// entirely to req.user._id, never a role-gated area. requireSellerMember
// and requirePlatform (used by every seller/admin route) are never
// involved, so a plain customer naturally has no way to reach them —
// see tests/milestone5-customer.test.js for the explicit check.
router.use(requireAuth);
router.use(writeLimiter);

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().regex(/^(?:\+94|0)\d{9}$/, 'Enter a valid Sri Lankan phone number').optional(),
  preferredLanguage: z.enum(['en', 'si', 'ta']).optional(),
}).strict();

const addressBodySchema = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  district: z.enum(SRI_LANKA_DISTRICTS),
  landmark: z.string().trim().max(200).optional(),
  phone: z.string().trim().regex(/^(?:\+94|0)\d{9}$/, 'Enter a valid Sri Lankan phone number'),
  isDefault: z.boolean().optional(),
}).strict();

const updateAddressBodySchema = addressBodySchema.partial();

const vehicleBodySchema = z.object({
  makeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  modelName: z.string().trim().min(1).max(80),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1).nullable().optional(),
}).strict();

router.get('/profile', asyncHandler(getProfile));
router.patch('/profile', validate({ body: updateProfileSchema }), asyncHandler(updateProfile));

router.get('/addresses', asyncHandler(listAddresses));
router.post('/addresses', validate({ body: addressBodySchema }), asyncHandler(createAddress));
router.patch('/addresses/:addressId', requireValidObjectId('addressId'), validate({ body: updateAddressBodySchema }), asyncHandler(updateAddress));
router.delete('/addresses/:addressId', requireValidObjectId('addressId'), asyncHandler(deleteAddress));

router.get('/vehicles', asyncHandler(listVehicles));
router.post('/vehicles', validate({ body: vehicleBodySchema }), asyncHandler(createVehicle));
router.delete('/vehicles/:vehicleId', requireValidObjectId('vehicleId'), asyncHandler(deleteVehicle));

module.exports = router;
