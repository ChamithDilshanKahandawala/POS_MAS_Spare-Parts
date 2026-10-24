const Seller = require('../models/Seller');
const Listing = require('../models/Listing');
const SellerOrder = require('../models/SellerOrder');

// "Get your store ready" checklist — every item is computed from real
// data; `available: false` would mean "no milestone to check this yet",
// which no longer applies to any item now that Milestone 3 exists.
function buildChecklist(seller, hasAnyListing) {
  const hasHours = seller.operatingHours.some((d) => !d.closed && d.open && d.close);
  const items = [
    { key: 'logo', done: !!seller.logo?.path, available: true },
    { key: 'banner', done: !!seller.banner?.path, available: true },
    { key: 'aboutText', done: !!seller.aboutText?.en?.trim(), available: true },
    { key: 'hours', done: hasHours, available: true },
    { key: 'returnAddress', done: !!seller.returnAddress?.trim(), available: true },
    { key: 'bankVerified', done: seller.bankAccount?.status === 'verified', available: true },
    { key: 'firstListing', done: hasAnyListing, available: true },
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
  const seller = await Seller.findById(req.sellerId).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  // "List your first product" means actually submitted it, not just
  // started a draft.
  const hasAnyListing = await Listing.exists({ seller: req.sellerId, status: { $ne: 'draft' } });

  // Follow-up — only ever non-zero for a POS-connected seller (see
  // services/posRecordedReminder.js, the job this count mirrors); 0 for
  // everyone else, not null, since "not recorded in POS" is a real,
  // always-answerable question once Milestone 6 exists, unlike
  // ordersToday/pendingPayout below.
  const notRecordedInPosCount = seller.posConnection?.enabled
    ? await SellerOrder.countDocuments({ seller: req.sellerId, status: { $in: ['shipped', 'delivered'] }, posRecorded: false })
    : 0;

  res.json({
    seller: {
      id: seller._id,
      name: seller.name,
      displayName: seller.displayName,
      status: seller.status,
      probationUntil: seller.probationUntil,
    },
    myRole: req.sellerMember.role,
    checklist: buildChecklist(seller, !!hasAnyListing),
    ordersToday: null,
    pendingPayout: null,
    notRecordedInPosCount,
  });
};

module.exports = { getHome };
