const crypto = require('crypto');
const logger = require('../utils/logger');

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Gives every request an id (kept from a proxy's X-Request-Id when it looks
// sane), returns it as a header, and logs one line per request with timing.
// Error responses carry the same id so a user's report can be matched to logs.
function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const fields = {
      requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0],
      status: res.statusCode, ms: Math.round(ms), userId: req.user?._id ? String(req.user._id) : undefined,
    };
    if (res.statusCode >= 500) logger.error('request failed', fields);
    else if (process.env.NODE_ENV === 'production' || process.env.LOG_REQUESTS === 'true') logger.info('request', fields);
  });
  next();
}

module.exports = { requestContext };
