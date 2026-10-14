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

module.exports = { validate };
