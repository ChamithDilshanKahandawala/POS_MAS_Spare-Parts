const { generateOtpCode, hashOtpCode, otpExpiryDate } = require('./otpCode');
const { getColomboDateParts } = require('../utils/colomboDate');
const { sendNow } = require('./messaging');

// One place that issues and delivers OTP codes (login and step-up): SMS when
// the user has a phone, otherwise email; a resend cooldown and a per-user
// daily cap shared by both purposes. Limits read env at call time so tests
// can tighten them per test (.env.test relaxes them for everything else).
const cooldownMs = () => Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60) * 1000;
const dailyLimit = () => Number(process.env.OTP_DAILY_LIMIT ?? 10);

const FIELDS = {
  login: { hash: 'otpCodeHash', expires: 'otpExpiresAt', template: 'otp.login' },
  stepup: { hash: 'stepUpOtpHash', expires: 'stepUpOtpExpiresAt', template: 'otp.stepup' },
};

class OtpRateLimited extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function colomboDayKey(now) {
  const { year, month, day } = getColomboDateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// `user` must be a full (non-lean) User document. Returns the plain code so
// NODE_ENV=test responses can echo it; callers must never return it otherwise.
async function issueOtp(user, purpose, now = new Date()) {
  const fields = FIELDS[purpose];
  if (!fields) throw new Error(`Unknown OTP purpose: ${purpose}`);

  const sinceLast = user.otpLastSentAt ? now - user.otpLastSentAt : Infinity;
  if (sinceLast < cooldownMs()) {
    const wait = Math.ceil((cooldownMs() - sinceLast) / 1000);
    throw new OtpRateLimited(`Please wait ${wait} seconds before requesting another code.`, wait);
  }
  const today = colomboDayKey(now);
  const sentToday = user.otpSendDay === today ? user.otpSendCount : 0;
  if (sentToday >= dailyLimit()) {
    throw new OtpRateLimited('Too many codes requested today. Please try again tomorrow.', null);
  }

  const previous = { lastSentAt: user.otpLastSentAt, day: user.otpSendDay, count: user.otpSendCount };
  const code = generateOtpCode();
  user[fields.hash] = await hashOtpCode(code);
  user[fields.expires] = otpExpiryDate();
  user.otpLastSentAt = now;
  user.otpSendDay = today;
  user.otpSendCount = sentToday + 1;
  await user.save();

  try {
    await sendNow({ user, template: fields.template, vars: { code } });
  } catch (err) {
    // Nothing reached the user, so this attempt doesn't count toward limits.
    user.otpLastSentAt = previous.lastSentAt;
    user.otpSendDay = previous.day;
    user.otpSendCount = previous.count;
    await user.save();
    throw err;
  }
  return code;
}

module.exports = { issueOtp, OtpRateLimited };
