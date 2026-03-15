const express = require('express');
const router = express.Router();
const { createSale, getSales, getSaleById, getAnalytics, getMyOrders, updateOrderStatus } = require('../controllers/saleController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/analytics/summary', protect, getAnalytics);
router.get('/my-orders', protect, getMyOrders);
router.get('/', protect, getSales);
router.get('/:id', protect, getSaleById);
router.put('/:id/status', protect, updateOrderStatus);
router.post('/', protect, createSale);

module.exports = router;
