const express = require('express');
const { z } = require('zod');
const router = express.Router();

const { listNotifications, markRead, markAllRead } = require('../controllers/notificationsController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, requireValidObjectId } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
}).strict();

router.get('/', requireAuth, validate({ query: listQuerySchema }), asyncHandler(listNotifications));
router.patch('/read-all', requireAuth, asyncHandler(markAllRead));
router.patch('/:id/read', requireAuth, requireValidObjectId('id'), asyncHandler(markRead));

module.exports = router;
