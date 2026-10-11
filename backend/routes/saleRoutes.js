const express = require('express');
const router = express.Router();
const { createSale, getSales, getWhatsappOrdersSummary, getSaleById, getSaleReceipt, getAnalytics, getMyOrders, getMyOrderById, updateOrderStatus, updateOrderDetails, deleteSale } = require('../controllers/saleController');
const { protect, adminOnly, superAdminOnly, staffOnly } = require('../middleware/authMiddleware');
const { saleLimiter } = require('../middleware/rateLimiter');

// Was `protect` only — a logged-in customer could read shop-wide revenue/
// profit/top-products. Scoped to staff per the customer-privilege audit.
router.get('/analytics/summary', protect, staffOnly, getAnalytics);
router.get('/whatsapp/summary', protect, staffOnly, getWhatsappOrdersSummary);
router.get('/my-orders', protect, getMyOrders);
// New route for the storefront's order-success page (/order-success/:id).
// Added here, after /my-orders — does not touch any existing route,
// response shape, model, or middleware. See getMyOrderById for why
// `protect` alone (no extra role middleware) is correct here.
router.get('/my-orders/:id', protect, getMyOrderById);
router.get('/', protect, staffOnly, getSales);
router.get('/:id', protect, staffOnly, getSaleById);
router.get('/:id/receipt', protect, staffOnly, getSaleReceipt);
router.put('/:id/status', protect, staffOnly, updateOrderStatus);
router.put('/:id/details', protect, adminOnly, updateOrderDetails);
router.delete('/:id', protect, superAdminOnly, deleteSale);
router.post('/', protect, saleLimiter, createSale);

module.exports = router;
