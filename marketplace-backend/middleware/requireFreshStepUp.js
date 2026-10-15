const STEP_UP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Gate for sensitive actions (saving a bank account) — requires the
// caller to have completed password + OTP step-up
// (controllers/sellerBankController.js's stepUpStart/stepUpVerify)
// within the last 5 minutes, not just be holding a valid access token.
// requireAuth must run first.
const requireFreshStepUp = (req, res, next) => {
  const verifiedAt = req.user.stepUpVerifiedAt;
  if (!verifiedAt || Date.now() - new Date(verifiedAt).getTime() > STEP_UP_WINDOW_MS) {
    return res.status(403).json({ message: 'Please confirm it\'s you — re-enter your password and the one-time code to continue.' });
  }
  return next();
};

module.exports = requireFreshStepUp;
