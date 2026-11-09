const mongoose = require('mongoose');
const MessageOutbox = require('../models/MessageOutbox');
const Payout = require('../models/Payout');
const User = require('../models/User');
const { notify } = require('./notifications');
const logger = require('../utils/logger');

// Operational health: the numbers /health reports and the conditions that
// alert platform owners (in-app notification + an error log line, which an
// error tracker or log alert can pick up). Each alert fires at most once per
// REPEAT_MS while its condition lasts.
const BACKLOG_AGE_MS = 15 * 60e3;
const BACKLOG_ALERT_COUNT = 20;
const FAILED_MESSAGES_ALERT_COUNT = 10;
const REPEAT_MS = 6 * 3600e3;
const lastFired = new Map();

async function collectHealth(now = new Date()) {
  const dbUp = mongoose.connection.readyState === 1;
  if (!dbUp) return { ok: false, db: 'down' };
  const [ping, backlog, failedLastHour, failedPayoutsLastDay] = await Promise.all([
    mongoose.connection.db.admin().ping().then(() => true).catch(() => false),
    MessageOutbox.countDocuments({ status: 'pending', nextAttemptAt: { $lte: new Date(now - BACKLOG_AGE_MS) } }),
    MessageOutbox.countDocuments({ status: 'failed', updatedAt: { $gte: new Date(now - 3600e3) } }),
    Payout.countDocuments({ status: 'failed', failedAt: { $gte: new Date(now - 24 * 3600e3) } }),
  ]);
  return {
    ok: ping,
    db: ping ? 'up' : 'down',
    outbox: { overdue: backlog, failedLastHour },
    payouts: { failedLastDay: failedPayoutsLastDay },
  };
}

async function raise(key, title, body, now) {
  const last = lastFired.get(key);
  if (last && now - last < REPEAT_MS) return false;
  lastFired.set(key, now.getTime());
  logger.error('ops alert', { alert: key, title, body });
  const owners = await User.find({ platformRole: 'platform_owner', isActive: true }).select('_id').lean();
  await Promise.all(owners.map((o) => notify({ userId: o._id, type: 'ops.alert', title, body, link: key.startsWith('payout') ? '/admin/finance' : '/admin/messages' })));
  return true;
}

// Checks every alert condition once; returns the keys that fired.
async function checkOpsAlerts(now = new Date()) {
  const h = await collectHealth(now);
  const fired = [];
  if (h.outbox?.overdue >= BACKLOG_ALERT_COUNT && await raise('outbox.backlog', `${h.outbox.overdue} emails/SMS are stuck in the queue`, 'Messages have been waiting more than 15 minutes. Check the email/SMS provider status and Admin → Messages.', now)) fired.push('outbox.backlog');
  if (h.outbox?.failedLastHour >= FAILED_MESSAGES_ALERT_COUNT && await raise('outbox.failures', `${h.outbox.failedLastHour} messages failed in the last hour`, 'They are listed in Admin → Messages with the provider error.', now)) fired.push('outbox.failures');
  if (h.payouts?.failedLastDay > 0 && await raise('payout.failed', `${h.payouts.failedLastDay} payout(s) failed in the last 24 hours`, 'Open Admin → Finance to see the reason and re-run them.', now)) fired.push('payout.failed');
  return fired;
}

// For a background job that threw: alert once per job name per REPEAT_MS.
function reportJobFailure(job, err) {
  return raise(`job.${job}`, `Background job "${job}" failed`, String(err?.message || err).slice(0, 300), new Date())
    .catch((e) => logger.error('ops alert failed', { job, error: e.message }));
}

function startOpsAlertsJob() {
  setInterval(() => {
    checkOpsAlerts().catch((err) => logger.error('ops alert check failed', { error: err.message }));
  }, 10 * 60e3);
}

function resetAlertsForTests() { lastFired.clear(); }

module.exports = { collectHealth, checkOpsAlerts, reportJobFailure, startOpsAlertsJob, resetAlertsForTests };
