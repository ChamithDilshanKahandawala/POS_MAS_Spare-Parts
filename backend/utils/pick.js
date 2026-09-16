// Returns a new object containing only the given keys from source (when
// present) — used to keep raw req.body out of Mongoose create/update calls,
// so a caller can't set fields beyond an explicit allow-list.
function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = { pick };
