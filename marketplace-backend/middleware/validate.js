const { ZodError } = require('zod');

// Every route validates body/params/query against a .strict() zod schema
// (defined next to the route, see routes/*.js) — unknown or privileged
// fields are REJECTED with 400, never silently dropped and never passed
// through. On success, req.body/params/query are replaced with the
// parsed output, so downstream handlers only ever see validated data —
// there's no way for a handler to accidentally read an unvalidated field.
function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (params) req.params = params.parse(req.params);
      if (query) req.query = query.parse(req.query);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
      }
      return next(err);
    }
  };
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// A malformed id in a URL (not a validation error on *input shape*, but
// on an *address* — the thing a 404 is for) gets a 404, never the 400
// that the rest of this file's `validate()` uses for request bodies and
// query strings. Same reasoning as requireSellerMember's malformed
// X-Seller-Id handling (middleware/authMiddleware.js) — a malformed id
// is indistinguishable from "no such resource" to the caller.
function requireValidObjectId(paramName) {
  return (req, res, next) => {
    if (!OBJECT_ID_RE.test(req.params[paramName])) {
      return res.status(404).json({ message: 'Not found' });
    }
    return next();
  };
}

module.exports = { validate, requireValidObjectId };
