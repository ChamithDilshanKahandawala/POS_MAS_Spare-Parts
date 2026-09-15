const express = require('express');
const router  = express.Router();
const { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, updateCredit } = require('../controllers/customerController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.get('/',           protect, staffOnly, getCustomers);
router.get('/:id',        protect, staffOnly, getCustomerById);
router.post('/',          protect, createCustomer);
router.put('/:id',        protect, updateCustomer);
router.delete('/:id',     protect, deleteCustomer);
router.put('/:id/credit', protect, updateCredit);

module.exports = router;
