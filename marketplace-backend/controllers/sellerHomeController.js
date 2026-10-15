const Seller = require('../models/Seller');

// "Get your store ready" checklist — every item except the last is
// computed from real data on the Seller document; `available: false`
// items (first listing, needs Milestone 3's Product model) are always
// shown but never counted toward progress, and never fabricated as done.
function buildChecklist(seller) {
  const hasHours = seller.operatingHours.some((d) => !d.closed && d.open && d.close);
  const items = [
    { key: 'logo', done: !!seller.logo?.path, available: true },
    { key: 'banner', done: !!seller.banner?.path, available: true },
    { key: 'aboutText', done: !!seller.aboutText?.en?.trim(), available: true },
    { key: 'hours', done: hasHours, available: true },
    { key: 'returnAddress', done: !!seller.returnAddress?.trim(), available: true },
    { key: 'bankVerified', done: seller.bankAccount?.status === 'verified', available: true },
    { key: 'firstListing', done: false, available: false }, // Milestone 3
  ];
  const countable = items.filter((i) => i.available);
  const completed = countable.filter((i) => i.done).length;
  return { items, completed, total: countable.length };
}

// GET /api/seller/me/home — status, probation, the readiness checklist,
// and explicit empty-state markers for orders/payouts (Milestones 6/7
// don't exist yet — ordersToday/pendingPayout are null, never 0, so the
// UI can't mistake "no data yet" for "zero today").
const getHome = async (req, res) => {
  const seller = await Seller.findById(req.sellerId);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  res.json({
    seller: {
      id: seller._id,
      name: seller.name,
      displayName: seller.displayName,
      status: seller.status,
      probationUntil: seller.probationUntil,
    },
    myRole: req.sellerMember.role,
    checklist: buildChecklist(seller),
    ordersToday: null,
    pendingPayout: null,
  });
};

module.exports = { getHome };
