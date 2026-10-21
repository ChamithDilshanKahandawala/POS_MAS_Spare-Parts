// Milestone 4 Part B — the seller-side surface for services/posIntegration.js.
// The console never talks to the POS directly and never sees the
// integration key; every function here loads the seller (re-selecting
// posConnection.encryptedKey only in-process, never returning it) and
// calls the service, which is the only thing that ever fetches the POS.
const Seller = require('../models/Seller');
const PosSyncRun = require('../models/PosSyncRun');
const { listImportableProducts, importProducts, runSync, PosFetchError } = require('../services/posIntegration');
const { logAction } = require('../services/auditLog');

// Shared by every route below: a seller whose connection isn't enabled
// gets the same 404 as a seller who doesn't exist, so a non-Seller-1
// store can never probe whether a connection row exists at all.
async function loadEnabledSeller(sellerId, { withKey = false } = {}) {
  const query = Seller.findById(sellerId);
  if (withKey) query.select('+posConnection.encryptedKey');
  const seller = await query;
  if (!seller || !seller.posConnection?.enabled) return null;
  return seller;
}

// GET /api/seller/pos/products — the Import-from-POS browser's data source.
const listProducts = async (req, res) => {
  const seller = await loadEnabledSeller(req.sellerId, { withKey: true });
  if (!seller) return res.status(404).json({ message: 'POS connection not found' });

  const { search, category, notImported } = req.query;
  try {
    const products = await listImportableProducts(seller, { search, category, notImported: notImported === 'true' });
    res.json({ products });
  } catch (err) {
    if (err instanceof PosFetchError) return res.status(502).json({ message: err.message });
    throw err;
  }
};

// POST /api/seller/pos/import — staff may import (if allowed by role at
// the route) but never sees or changes the key; the key never appears
// here at all, only `seller` (with its encryptedKey) does, in-process.
const importSelected = async (req, res) => {
  const { posProductIds } = req.body;
  const seller = await loadEnabledSeller(req.sellerId, { withKey: true });
  if (!seller) return res.status(404).json({ message: 'POS connection not found' });

  try {
    const { created, skipped } = await importProducts(seller, posProductIds, req.user._id);

    await logAction({
      actor: req.user,
      actorRole: req.sellerMember.role,
      action: 'seller.pos.import',
      targetType: 'Seller',
      targetId: seller._id,
      after: { createdCount: created.length, skippedCount: skipped.length, posProductIds },
      summary: `${req.user.name} imported ${created.length} product(s) from the POS (${skipped.length} skipped).`,
    });

    res.json({
      created: created.map((l) => ({ id: l._id, title: l.title, posProductId: l.posProductId, categoryId: l.categoryId, priceCents: l.priceCents, stock: l.stock })),
      skipped,
    });
  } catch (err) {
    if (err instanceof PosFetchError) return res.status(502).json({ message: err.message });
    throw err;
  }
};

// POST /api/seller/pos/sync — the "Sync now" button, owner only (route-gated).
const syncNow = async (req, res) => {
  const seller = await loadEnabledSeller(req.sellerId);
  if (!seller) return res.status(404).json({ message: 'POS connection not found' });

  const run = await runSync(req.sellerId, 'manual');
  res.json({ run });
};

// GET /api/seller/pos/status — the Store settings "POS connection" panel.
// Never 404s on a disabled store: this is how the console tells whether
// to show "off" at all, unlike /products and /import which are genuine
// POS actions and 404 when there's nothing to act on.
const getStatus = async (req, res) => {
  const seller = await Seller.findById(req.sellerId).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const conn = seller.posConnection || {};
  const runs = await PosSyncRun.find({ seller: req.sellerId }).sort({ startedAt: -1 }).limit(20).lean();
  const lastRun = runs[0] || null;

  let status = 'off';
  if (conn.enabled) {
    status = lastRun?.status === 'failed' && conn.consecutiveFailures >= 3 ? 'failing' : 'connected';
  }

  res.json({
    status,
    enabled: !!conn.enabled,
    baseUrl: conn.baseUrl || '',
    keyLast4: conn.keyLast4 || '',
    lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt || null,
    consecutiveFailures: conn.consecutiveFailures || 0,
    runs,
  });
};

module.exports = { listProducts, importSelected, syncNow, getStatus };
