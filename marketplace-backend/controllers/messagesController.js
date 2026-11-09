const MessageOutbox = require('../models/MessageOutbox');
const User = require('../models/User');
const { retryMessage, maskRecipient } = require('../services/messaging');
const { PREFERENCE_GROUPS } = require('../services/messageTemplates');
const { logAction } = require('../services/auditLog');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/messages?status=&channel=&template=&q=&page=
// Recipients are masked in the list; the body is the stored copy, which for
// OTPs and links is already the masked version.
const listMessages = async (req, res) => {
  const { status, channel, template, q, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  if (template) filter.template = template;
  if (q) filter.to = { $regex: escapeRegex(q), $options: 'i' };
  const safeLimit = Math.min(Number(limit) || 25, 100);
  const [rows, total, failedCount] = await Promise.all([
    MessageOutbox.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    MessageOutbox.countDocuments(filter),
    MessageOutbox.countDocuments({ status: 'failed' }),
  ]);
  res.json({
    messages: rows.map((m) => ({ ...m, to: maskRecipient(m.to) })),
    total, page: Number(page), limit: safeLimit, failedCount,
  });
};

// POST /api/admin/messages/:id/retry — failed, non-secret messages only.
const retry = async (req, res) => {
  const row = await MessageOutbox.findById(req.params.id).lean();
  if (!row) return res.status(404).json({ message: 'Message not found' });
  if (row.redacted) return res.status(409).json({ message: 'Codes and links are never stored, so this message cannot be resent. Ask the person to request a new one.' });
  const updated = await retryMessage(row._id);
  if (!updated) return res.status(409).json({ message: 'Only failed messages can be retried.' });

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'message.retry',
    targetType: 'MessageOutbox',
    targetId: row._id,
    before: { status: row.status, attempts: row.attempts },
    after: { status: 'pending' },
    summary: `Retried ${row.channel} "${row.template}" to ${maskRecipient(row.to)}`,
  });
  res.json({ message: { ...updated.toObject(), to: maskRecipient(updated.to) } });
};

// GET/PATCH /api/seller/me/notification-preferences — the signed-in user's
// own email/SMS switches. Security and account messages are not listed
// because they can't be turned off.
const getPreferences = async (req, res) => {
  const user = await User.findById(req.user._id).select('notificationPrefs email phone').lean();
  // Older accounts may predate the field; every switch defaults to on.
  const preferences = Object.fromEntries(PREFERENCE_GROUPS.map((g) => [g, { email: user.notificationPrefs?.[g]?.email !== false, sms: user.notificationPrefs?.[g]?.sms !== false }]));
  res.json({ preferences, groups: PREFERENCE_GROUPS, hasEmail: !!user.email, hasPhone: !!user.phone, phone: user.phone || '' });
};

const updatePreferences = async (req, res) => {
  const $set = {};
  for (const group of PREFERENCE_GROUPS) {
    for (const channel of ['email', 'sms']) {
      const value = req.body[group]?.[channel];
      if (typeof value === 'boolean') $set[`notificationPrefs.${group}.${channel}`] = value;
    }
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set }, { new: true }).select('notificationPrefs').lean();
  res.json({ preferences: user.notificationPrefs });
};

module.exports = { listMessages, retry, getPreferences, updatePreferences };
