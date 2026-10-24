// Milestone 6 Part C — the real, logged-in checkout. Every route here
// sits behind requireAuth (routes/customerRoutes.js), scoped entirely to
// req.user — a customer can only ever check out against their OWN saved
// address, never one passed loosely in the body.
const { previewCheckout, placeOrder, CheckoutRejected } = require('../services/orderCreation');
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');

function findOwnAddress(user, addressId) {
  return user.addresses.id(addressId);
}

function serializeSellerGroup(group) {
  return {
    sellerId: group.seller._id,
    sellerName: group.seller.displayName || group.seller.name,
    items: group.lines.map((l) => ({
      listingId: l.listingId, title: l.title, sku: l.sku, unitPriceCents: l.unitPriceCents,
      qty: l.qty, lineTotalCents: l.lineTotalCents, weightEstimated: l.weightEstimated,
    })),
    itemsTotalCents: group.itemsTotalCents,
    deliveryFeeCents: group.deliveryFeeCents,
    codAmountCents: group.codAmountCents,
    weightKg: group.weightKg,
  };
}

// POST /api/customer/checkout/preview — read-only, safe to call on every
// cart/address change. Never reserves stock.
const preview = async (req, res) => {
  const address = findOwnAddress(req.user, req.body.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });

  try {
    const result = await previewCheckout({ district: address.district, items: req.body.items });
    res.json({
      sellerGroups: result.sellerGroups.map(serializeSellerGroup),
      itemsTotalCents: result.itemsTotalCents,
      deliveryTotalCents: result.deliveryTotalCents,
      grandTotalCents: result.grandTotalCents,
    });
  } catch (err) {
    if (err instanceof CheckoutRejected) {
      return res.status(409).json({ message: 'Some items in your cart changed', issues: err.issues });
    }
    throw err;
  }
};

// POST /api/customer/orders — places the real order. onlineOrderingEnabled
// is re-checked server-side inside services/orderCreation.js, independent
// of whatever the storefront UI currently shows.
const create = async (req, res) => {
  const address = findOwnAddress(req.user, req.body.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });

  try {
    const { order, alreadyPlaced } = await placeOrder({
      customer: req.user,
      address: address.toObject ? address.toObject() : address,
      customerNote: req.body.customerNote,
      items: req.body.items,
      idempotencyKey: req.body.idempotencyKey,
    });
    const sellerOrders = await SellerOrder.find({ order: order._id }).lean();
    res.status(alreadyPlaced ? 200 : 201).json({ order, sellerOrders });
  } catch (err) {
    if (err instanceof CheckoutRejected) {
      return res.status(409).json({ message: 'Some items in your cart changed — please review and try again', issues: err.issues });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ message: err.message });
    }
    throw err;
  }
};

module.exports = { preview, create };
