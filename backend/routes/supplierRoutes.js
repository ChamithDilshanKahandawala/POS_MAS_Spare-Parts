const express = require('express');
const router  = express.Router();
const { getSuppliers, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const { protect, adminOnly, staffOnly } = require('../middleware/authMiddleware');

router.get('/',       protect, getSuppliers);
router.post('/',      protect, staffOnly, createSupplier);
router.put('/:id',    protect, staffOnly, updateSupplier);
router.delete('/:id', protect, adminOnly, deleteSupplier);

module.exports = router;
