const logger = require('../utils/logger');

// Centralized error handler — a thrown/rejected error in any route lands here
// instead of crashing the process. In production a 5xx never echoes internal
// error text; every error response carries the request id for support.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) logger.error('unhandled error', { requestId: req.id, path: req.originalUrl, error: err.message, stack: err.stack });
  const hide = status >= 500 && process.env.NODE_ENV === 'production';
  res.status(status).json({ message: hide ? 'Something went wrong. Please try again.' : (err.message || 'Server error'), requestId: req.id });
}

module.exports = { errorHandler };
