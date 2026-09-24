const express = require('express');
const router = express.Router();
const { createSale, getSales, getWhatsappOrdersSummary, getSaleById, getSaleReceipt, getAnalytics, getMyOrders, updateOrderStatus, deleteSale } = require('../controllers/saleController');
const { protect, adminOnly, superAdminOnly, staffOnly } = require('../middleware/authMiddleware');
const { saleLimiter } = require('../middleware/rateLimiter');

router.get('/analytics/summary', protect, getAnalytics);
router.get('/whatsapp/summary', protect, staffOnly, getWhatsappOrdersSummary);
router.get('/my-orders', protect, getMyOrders);
router.get('/', protect, staffOnly, getSales);
router.get('/:id', protect, staffOnly, getSaleById);
router.get('/:id/receipt', protect, staffOnly, getSaleReceipt);
router.put('/:id/status', protect, staffOnly, updateOrderStatus);
router.delete('/:id', protect, superAdminOnly, deleteSale);
router.post('/', protect, saleLimiter, createSale);

module.exports = router;
