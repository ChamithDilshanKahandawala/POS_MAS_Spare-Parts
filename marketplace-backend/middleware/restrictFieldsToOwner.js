// Gates specific body fields to platform_owner only — e.g. a category's
// commissionRateBps/regulated/reviewRequired (routes/adminRoutes.js's
// catalog routes). Platform staff sending one of these fields gets a 403
// naming exactly which field(s) aren't theirs to change, never a silent
// drop — same "reject, don't ignore" rule every other admin write in
// this project follows. requireAuth + validate() must run first (this
// reads req.user and the already-parsed req.body).
function restrictFieldsToOwner(fields) {
  return (req, res, next) => {
    if (req.user.platformRole === 'platform_owner') return next();
    const present = fields.filter((f) => Object.prototype.hasOwnProperty.call(req.body, f));
    if (present.length > 0) {
      return res.status(403).json({ message: `Only the platform owner can change: ${present.join(', ')}` });
    }
    return next();
  };
}

module.exports = restrictFieldsToOwner;
