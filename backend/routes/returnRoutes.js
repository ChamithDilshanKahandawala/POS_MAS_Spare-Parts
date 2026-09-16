const express = require('express');
const router  = express.Router();
const { createReturn, getReturns } = require('../controllers/returnController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.get('/',  protect, staffOnly, getReturns);
router.post('/', protect, staffOnly, createReturn);

module.exports = router;
