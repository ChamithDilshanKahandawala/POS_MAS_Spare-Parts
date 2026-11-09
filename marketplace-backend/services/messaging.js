const MessageOutbox = require('../models/MessageOutbox');
const User = require('../models/User');
const { TEMPLATES, PREFERENCE_GROUPS, renderTemplate } = require('./messageTemplates');

// Outgoing email/SMS. Two paths:
// - queueMessage(): the normal path. Rows go into MessageOutbox (inside the
//   caller's transaction when it passes `session`) and the worker below sends
//   them with retries.
// - sendNow(): for messages that carry a secret (OTP codes, reset links).
//   The secret is never written to the database — the stored row is a masked
//   copy — so these are sent immediately and cannot be retried; the user just
//   asks for a new code.

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60e3, 5 * 60e3, 30 * 60e3, 2 * 3600e3];
const LOCK_MS = 2 * 60e3;
const MASK = '••••••';

// ---------- Providers ----------
// A provider is { name, send({ to, subject, text }) -> { id } }. Real
// adapters (email + Sri Lankan SMS gateway) plug in here once chosen; the
// console provider is the dev/test default.
const testOutbox = [];

const consoleProvider = (channel) => ({
  name: 'console',
  async send({ to, subject, text }) {
    // Never print real message text (OTP codes, reset/invite links) to
    // production logs: without a real provider, sending fails visibly instead.
    if (process.env.NODE_ENV === 'production') throw new Error(`No ${channel} provider configured (console provider is disabled in production)`);
    const id = `console-${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (process.env.NODE_ENV === 'test') {
      testOutbox.push({ channel, to, subject, text, id });
    } else {
      console.log(`\n📨 [${channel}:console] To: ${to}${subject ? ` — ${subject}` : ''}\n${text}\n`);
    }
    return { id };
  },
});

const PROVIDER_FACTORIES = {
  console: consoleProvider,
};

const overrides = {};

function providerFor(channel) {
  if (overrides[channel]) return overrides[channel];
  const name = (channel === 'email' ? process.env.EMAIL_PROVIDER : process.env.SMS_PROVIDER) || 'console';
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown ${channel} provider "${name}"`);
  return factory(channel);
}

// Tests swap a provider in (e.g. one that fails twice) and back out with null.
function setProviderForTests(channel, provider) {
  if (provider) overrides[channel] = provider; else delete overrides[channel];
}

// ---------- Recipients ----------
// Sri Lankan numbers are stored as typed ("0771234567", "+94 77 123 4567");
// gateways want E.164.
function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^94\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+94${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+94${digits}`;
  return null;
}

function maskRecipient(to) {
  if (to.includes('@')) {
    const [local, domain] = to.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${to.slice(0, 5)}***${to.slice(-2)}`;
}

function wantsChannel(user, group, channel) {
  if (!PREFERENCE_GROUPS.includes(group)) return true;
  return user?.notificationPrefs?.[group]?.[channel] !== false;
}

// Decides which channels a template goes out on for this recipient.
function planDeliveries({ template, user, email, phone }) {
  const def = TEMPLATES[template];
  if (!def) throw new Error(`Unknown message template: ${template}`);
  const smsTo = toE164(phone);
  const hasSms = !!def.en.sms;
  const out = [];
  if (def.delivery === 'one') {
    if (smsTo && hasSms) out.push({ channel: 'sms', to: smsTo });
    else if (email) out.push({ channel: 'email', to: email });
    return out;
  }
  if (email && wantsChannel(user, def.group, 'email')) out.push({ channel: 'email', to: email });
  if (smsTo && hasSms && wantsChannel(user, def.group, 'sms')) out.push({ channel: 'sms', to: smsTo });
  return out;
}

async function resolveRecipient({ userId, user, to, language, session }) {
  if (user || userId) {
    const doc = user || await User.findById(userId).select('email phone preferredLanguage notificationPrefs').session(session || null).lean();
    if (!doc) return null;
    return { user: doc, email: doc.email, phone: doc.phone, language: language || doc.preferredLanguage || 'en' };
  }
  return { user: null, email: to, phone: null, language: language || 'en' };
}

function rowFor({ delivery, recipient, template, rendered }) {
  return {
    channel: delivery.channel,
    to: delivery.to,
    user: recipient.user?._id || null,
    template,
    language: recipient.language,
    subject: delivery.channel === 'email' ? rendered.subject : '',
    body: delivery.channel === 'sms' ? rendered.sms : rendered.text,
  };
}

// ---------- Queue (normal path) ----------
// Pass `userId`/`user` for an account, or `to` for an address with no
// account yet (invites, applications). Returns the created rows.
async function queueMessage({ userId, user, to, language, template, vars = {}, session }) {
  if (TEMPLATES[template]?.redact) throw new Error(`${template} carries a secret — use sendNow()`);
  const recipient = await resolveRecipient({ userId, user, to, language, session });
  if (!recipient) return [];
  const deliveries = planDeliveries({ template, user: recipient.user, email: recipient.email, phone: recipient.phone });
  if (deliveries.length === 0) return [];
  const rendered = renderTemplate(template, recipient.language, vars);
  const rows = deliveries.map((delivery) => rowFor({ delivery, recipient, template, rendered }));
  const created = await MessageOutbox.create(rows, session ? { session } : undefined);
  if (!session) kickWorker();
  return created;
}

// ---------- Send now (secrets) ----------
async function sendNow({ userId, user, to, language, template, vars = {} }) {
  const def = TEMPLATES[template];
  const recipient = await resolveRecipient({ userId, user, to, language });
  if (!recipient) throw new Error('Recipient not found');
  const deliveries = planDeliveries({ template, user: recipient.user, email: recipient.email, phone: recipient.phone });
  if (deliveries.length === 0) throw new Error('No email address or phone number to send to');

  const real = renderTemplate(template, recipient.language, vars);
  const maskedVars = { ...vars };
  for (const key of def.redact || []) maskedVars[key] = MASK;
  const masked = renderTemplate(template, recipient.language, maskedVars);

  const results = [];
  for (const delivery of deliveries) {
    const row = await MessageOutbox.create({
      ...rowFor({ delivery, recipient, template, rendered: masked }),
      redacted: true, status: 'sending', attempts: 1,
    });
    const provider = providerFor(delivery.channel);
    try {
      const { id } = await provider.send({ to: delivery.to, subject: delivery.channel === 'email' ? real.subject : '', text: delivery.channel === 'sms' ? real.sms : real.text });
      await MessageOutbox.updateOne({ _id: row._id }, { $set: { status: 'sent', provider: provider.name, providerMessageId: id, sentAt: new Date() } });
      results.push({ channel: delivery.channel, ok: true });
    } catch (err) {
      await MessageOutbox.updateOne({ _id: row._id }, { $set: { status: 'failed', provider: provider.name, lastError: String(err.message).slice(0, 500) } });
      results.push({ channel: delivery.channel, ok: false, error: err.message });
    }
  }
  if (!results.some((r) => r.ok)) {
    const err = new Error('We could not send the message. Please try again shortly.');
    err.statusCode = 502;
    throw err;
  }
  return results;
}

// ---------- Worker ----------
async function claimNext(now) {
  return MessageOutbox.findOneAndUpdate(
    {
      redacted: false,
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'sending', lockedUntil: { $lt: now } },
      ],
    },
    { $set: { status: 'sending', lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true }
  );
}

async function deliver(row, now) {
  const provider = providerFor(row.channel);
  try {
    const { id } = await provider.send({ to: row.to, subject: row.subject, text: row.body });
    await MessageOutbox.updateOne({ _id: row._id }, { $set: { status: 'sent', provider: provider.name, providerMessageId: id, sentAt: new Date(), lockedUntil: null, lastError: '' } });
    return 'sent';
  } catch (err) {
    const giveUp = row.attempts >= MAX_ATTEMPTS;
    const delay = BACKOFF_MS[Math.min(row.attempts - 1, BACKOFF_MS.length - 1)];
    await MessageOutbox.updateOne({ _id: row._id }, {
      $set: {
        status: giveUp ? 'failed' : 'pending',
        nextAttemptAt: giveUp ? row.nextAttemptAt : new Date(now.getTime() + delay),
        provider: provider.name,
        lastError: String(err.message).slice(0, 500),
        lockedUntil: null,
      },
    });
    return giveUp ? 'failed' : 'retry';
  }
}

// Sends everything due, one row at a time (each claim is atomic, so two
// workers never send the same row).
async function processOutbox({ now = new Date(), limit = 50 } = {}) {
  const counts = { sent: 0, retry: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const row = await claimNext(now);
    if (!row) break;
    counts[await deliver(row, now)] += 1;
  }
  return counts;
}

// Admin retry: a failed row goes back in the queue with a fresh set of attempts.
async function retryMessage(id) {
  return MessageOutbox.findOneAndUpdate(
    { _id: id, status: 'failed', redacted: false },
    { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: '' } },
    { new: true }
  );
}

let running = false;
async function runOnce() {
  if (running) return;
  running = true;
  try { await processOutbox(); } catch (err) { console.error('[messaging] outbox run failed:', err.message); } finally { running = false; }
}

function kickWorker() {
  if (process.env.NODE_ENV === 'test') return;
  setTimeout(runOnce, 250);
}

function startMessageOutboxJob() {
  for (const channel of ['email', 'sms']) {
    const name = providerFor(channel).name;
    if (name === 'console' && process.env.NODE_ENV === 'production') {
      console.error(`[messaging] ${channel} provider is "console" in production — every ${channel} send will fail until a real provider is configured.`);
    }
  }
  setInterval(runOnce, 10e3);
}

module.exports = {
  queueMessage, sendNow, processOutbox, retryMessage, startMessageOutboxJob,
  setProviderForTests, testOutbox, toE164, maskRecipient, planDeliveries, MAX_ATTEMPTS,
};
