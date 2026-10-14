// Express 4 does not catch a rejected promise from an async route handler
// on its own (that's an Express 5 behavior) — without this, a thrown
// Mongoose error inside any controller here would hang the request
// instead of reaching server.js's error-handling middleware. Wrap every
// async controller function with this at the point it's registered on a
// router.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
