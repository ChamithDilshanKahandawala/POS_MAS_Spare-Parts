const express = require('express');
const router  = express.Router();
const { getSuppliers, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/',       protect, getSuppliers);
router.post('/',      protect, createSupplier);
router.put('/:id',    protect, updateSupplier);
router.delete('/:id', protect, adminOnly, deleteSupplier);

module.exports = router;
