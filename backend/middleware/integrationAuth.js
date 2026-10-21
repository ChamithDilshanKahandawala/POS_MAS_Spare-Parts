const crypto = require('crypto');

// Protects routes/integrationRoutes.js — a server-to-server, read-only
// feed the Apexora marketplace backend calls directly (never a browser,
// never the console), authenticated by a single shared key rather than
// a user login.
//
// Refuses to run at all if INTEGRATION_API_KEY isn't configured (503) —
// same "missing config means off, not open" precedent as GOOGLE_CLIENT_ID
// in controllers/authController.js — so a deploy that forgot to set the
// key can never accidentally expose this route with no protection at all.
const integrationAuth = (req, res, next) => {
  const configuredKey = process.env.INTEGRATION_API_KEY;
  if (!configuredKey) {
    return res.status(503).json({ message: 'Integration API is not configured' });
  }

  const providedKey = req.headers['x-integration-key'];
  if (!providedKey) {
    return res.status(401).json({ message: 'Missing X-Integration-Key header' });
  }

  // Timing-safe comparison — a plain === would leak how many leading
  // characters matched via response-time differences, letting an
  // attacker guess the key one character at a time. timingSafeEqual
  // throws on a length mismatch rather than returning false, so that
  // case is handled before ever calling it.
  const provided = Buffer.from(String(providedKey));
  const configured = Buffer.from(configuredKey);
  const matches = provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
  if (!matches) {
    return res.status(401).json({ message: 'Invalid integration key' });
  }

  return next();
};

module.exports = integrationAuth;
