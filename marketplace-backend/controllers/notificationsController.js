const Notification = require('../models/Notification');
const { clampLimit } = require('../utils/pagination');

const MAX_NOTIFICATIONS_LIMIT = 100;

// GET /api/notifications — this user's own notifications only. Shared
// across platform and seller users (requireAuth only, no seller/platform
// gate) since either kind of user can receive one.
const listNotifications = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const safeLimit = clampLimit(limit, 20, MAX_NOTIFICATIONS_LIMIT);

  const [entries, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  res.json({ entries, total, unreadCount, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

// PATCH /api/notifications/:id/read — scoped to `user: req.user._id`,
// never by id alone, so one user can never mark another's notification
// read (findOneAndUpdate matches nothing and 404s instead of leaking
// whether that id belongs to someone else).
const markRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Not found' });
  res.json({ notification });
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All marked read' });
};

module.exports = { listNotifications, markRead, markAllRead };
