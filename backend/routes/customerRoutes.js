const express = require('express');
const router  = express.Router();
const { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, updateCredit } = require('../controllers/customerController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.get('/',           protect, staffOnly, getCustomers);
router.get('/:id',        protect, staffOnly, getCustomerById);
router.post('/',          protect, staffOnly, createCustomer);
router.put('/:id',        protect, staffOnly, updateCustomer);
router.delete('/:id',     protect, staffOnly, deleteCustomer);
router.put('/:id/credit', protect, staffOnly, updateCredit);

module.exports = router;
