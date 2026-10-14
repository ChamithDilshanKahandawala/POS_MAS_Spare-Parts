const express = require('express');
const router = express.Router();

const { getMyStore, ownerOnlyPing } = require('../controllers/sellerController');
const { requireAuth, requireSellerMember } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/me/store', requireAuth, requireSellerMember(['seller_owner', 'seller_staff']), asyncHandler(getMyStore));
router.get('/owner-only-test', requireAuth, requireSellerMember(['seller_owner']), asyncHandler(ownerOnlyPing));

module.exports = router;
