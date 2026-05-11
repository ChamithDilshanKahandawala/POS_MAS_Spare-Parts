const express = require('express');
const router = express.Router();
const { createSale, getSales, getSaleById, getAnalytics, getMyOrders, updateOrderStatus, deleteSale } = require('../controllers/saleController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');

router.get('/analytics/summary', protect, getAnalytics);
router.get('/my-orders', protect, getMyOrders);
router.get('/', protect, getSales);
router.get('/:id', protect, getSaleById);
router.put('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, superAdminOnly, deleteSale);
router.post('/', protect, createSale);

module.exports = router;
