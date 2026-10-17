const express = require('express');
const router = express.Router();
const {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockAlerts,
} = require('../controllers/productController');
const { importProducts, importProductsJson, exportProducts, upload } = require('../controllers/excelController');
const { protect, adminOnly, staffOnly, optionalAuth } = require('../middleware/authMiddleware');
const { searchLimiter, bulkOpsLimiter } = require('../middleware/rateLimiter');

// Was `protect` only — a logged-in customer could read shop-wide stock
// levels including buying_price (cost). Scoped to staff per the
// customer-privilege audit.
router.get('/low-stock/alerts', protect, staffOnly, getLowStockAlerts);
router.post('/import', protect, adminOnly, bulkOpsLimiter, upload.single('file'), importProducts);
router.post('/import-json', protect, adminOnly, bulkOpsLimiter, importProductsJson);
router.get('/export', protect, adminOnly, bulkOpsLimiter, exportProducts);
router.get('/search', optionalAuth, searchLimiter, searchProducts);
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
