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
const { importProducts, exportProducts, upload } = require('../controllers/excelController');
const { protect, adminOnly, optionalAuth } = require('../middleware/authMiddleware');
const { searchLimiter, bulkOpsLimiter } = require('../middleware/rateLimiter');

router.get('/low-stock/alerts', protect, getLowStockAlerts);
router.post('/import', protect, adminOnly, bulkOpsLimiter, upload.single('file'), importProducts);
router.get('/export', protect, adminOnly, bulkOpsLimiter, exportProducts);
router.get('/search', optionalAuth, searchLimiter, searchProducts);
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
