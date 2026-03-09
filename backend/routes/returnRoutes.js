const express = require('express');
const router  = express.Router();
const { createReturn, getReturns } = require('../controllers/returnController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',  protect, getReturns);
router.post('/', protect, createReturn);

module.exports = router;
