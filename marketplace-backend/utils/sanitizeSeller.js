// The one place every seller-facing route strips the full bank account
// number before a response goes out. The schema's select:false on
// bankAccount.accountNumber (models/Seller.js) protects a FRESH query
// with no explicit select() — but an explicit inclusive .select(), or a
// document already loaded earlier in the same request, both bypass it
// (discovered the hard way: controllers/sellerBankController.js's old
// `.select('bankAccount')` silently returned the full number). Never
// rely on the schema alone for something this sensitive — every
// controller that sends a `seller` or `bankAccount` object to a seller
// (not an admin's explicit full-view route) runs it through this first.
function stripFullAccountNumber(seller) {
  const plain = typeof seller.toObject === 'function' ? seller.toObject() : seller;
  if (plain.bankAccount) delete plain.bankAccount.accountNumber;
  return plain;
}

module.exports = { stripFullAccountNumber };
