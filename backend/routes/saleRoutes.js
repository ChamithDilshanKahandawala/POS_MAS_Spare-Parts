const express = require('express');
const router = express.Router();
const { createSale, getSales, getSaleById, getSaleReceipt, getAnalytics, getMyOrders, updateOrderStatus, deleteSale } = require('../controllers/saleController');
const { protect, adminOnly, superAdminOnly, staffOnly } = require('../middleware/authMiddleware');

router.get('/analytics/summary', protect, getAnalytics);
router.get('/my-orders', protect, getMyOrders);
router.get('/', protect, staffOnly, getSales);
router.get('/:id', protect, staffOnly, getSaleById);
router.get('/:id/receipt', protect, staffOnly, getSaleReceipt);
router.put('/:id/status', protect, updateOrderStatus);
router.delete('/:id', protect, superAdminOnly, deleteSale);
router.post('/', protect, createSale);

module.exports = router;
