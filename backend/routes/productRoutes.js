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

router.get('/low-stock/alerts', protect, getLowStockAlerts);
router.post('/import', protect, adminOnly, upload.single('file'), importProducts);
router.get('/export', protect, adminOnly, exportProducts);
router.get('/search', optionalAuth, searchProducts);
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);
router.post('/', protect, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
