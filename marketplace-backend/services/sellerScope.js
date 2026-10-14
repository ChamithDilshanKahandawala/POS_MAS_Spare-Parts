// Every query against a seller-owned collection must go through this,
// so "forgot to filter by seller" can't happen as a one-off mistake in a
// single route. req.sellerId is only ever set by requireSellerMember
// (middleware/authMiddleware.js) after it has already verified the
// caller is actually a member of that seller — this helper does not
// re-check membership, it only applies the scope.
function sellerScope(query, req) {
  if (!req.sellerId) {
    throw new Error('sellerScope() called without req.sellerId — route must run requireSellerMember first');
  }
  return { ...query, seller: req.sellerId };
}

module.exports = { sellerScope };
