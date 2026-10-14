const express = require('express');
const { z } = require('zod');
const router = express.Router();

const { listSellers, updateSellerStatus, SELLER_STATUSES } = require('../controllers/adminController');
const { requireAuth, requirePlatform } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const PLATFORM_ROLES = ['platform_owner', 'platform_staff'];

const sellerIdParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid seller id'),
}).strict();

// Only `status` is accepted — role/platformRole/commissionOverridePct
// etc. sent in the same body are a 400 (unknown field), never silently
// ignored or accidentally applied.
const updateStatusBodySchema = z.object({
  status: z.enum(SELLER_STATUSES),
}).strict();

router.get('/sellers', requireAuth, requirePlatform(PLATFORM_ROLES), asyncHandler(listSellers));
router.patch(
  '/sellers/:id/status',
  requireAuth,
  requirePlatform(PLATFORM_ROLES),
  validate({ params: sellerIdParamsSchema, body: updateStatusBodySchema }),
  asyncHandler(updateSellerStatus)
);

module.exports = router;
