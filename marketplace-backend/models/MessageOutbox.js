const mongoose = require('mongoose');

const CHANNELS = ['email', 'sms'];
const STATUSES = ['pending', 'sending', 'sent', 'failed'];

// One outgoing email or SMS. Rows are written next to the event that causes
// them (inside its transaction where the event has one) and sent by
// services/messageOutboxWorker.js, so a provider outage delays a message
// instead of losing it. OTP rows never store the code: `redacted` is set and
// the body kept here is the masked copy.
const messageOutboxSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, required: true },
    to: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    template: { type: String, required: true },
    language: { type: String, enum: ['en', 'si', 'ta'], default: 'en' },
    subject: { type: String, default: '' },
    body: { type: String, required: true },
    redacted: { type: Boolean, default: false },

    status: { type: String, enum: STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: { type: Date, default: null },
    provider: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    lastError: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
messageOutboxSchema.index({ createdAt: -1 });
messageOutboxSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('MessageOutbox', messageOutboxSchema);
module.exports.CHANNELS = CHANNELS;
module.exports.STATUSES = STATUSES;
