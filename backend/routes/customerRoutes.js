const express = require('express');
const router  = express.Router();
const { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, updateCredit } = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',           protect, getCustomers);
router.get('/:id',        protect, getCustomerById);
router.post('/',          protect, createCustomer);
router.put('/:id',        protect, updateCustomer);
router.delete('/:id',     protect, deleteCustomer);
router.put('/:id/credit', protect, updateCredit);

module.exports = router;
