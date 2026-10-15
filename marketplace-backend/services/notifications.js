const Notification = require('../models/Notification');

// The only place that creates a Notification document — mirrors
// services/auditLog.js's logAction() pattern (one writer, called from
// wherever the underlying event actually happens).
async function notify({ userId, type, title, body = '', link = null }) {
  return Notification.create({ user: userId, type, title, body, link });
}

module.exports = { notify };
