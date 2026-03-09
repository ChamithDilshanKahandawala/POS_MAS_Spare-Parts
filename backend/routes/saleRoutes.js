const express = require('express');
const router = express.Router();
const { createSale, getSales, getSaleById, getAnalytics } = require('../controllers/saleController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/analytics/summary', protect, getAnalytics);
router.get('/', protect, getSales);
router.get('/:id', protect, getSaleById);
router.post('/', protect, createSale);

module.exports = router;
