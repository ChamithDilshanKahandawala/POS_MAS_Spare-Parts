// Milestone 4 Part B — admin side: enabling/disabling a seller's POS
// connection and viewing its sync history. Only this controller ever
// calls encrypt() on a raw integration key; the key itself is never
// echoed back in the response or written into an audit entry — only
// keyLast4 is, same pattern as Seller.bankAccount's last4.
const Seller = require('../models/Seller');
const PosSyncRun = require('../models/PosSyncRun');
const { encrypt } = require('../services/encryption');
const { logAction } = require('../services/auditLog');

function serializeConnection(seller) {
  const conn = seller.posConnection || {};
  return {
    enabled: !!conn.enabled,
    baseUrl: conn.baseUrl || '',
    keyLast4: conn.keyLast4 || '',
    lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt || null,
    consecutiveFailures: conn.consecutiveFailures || 0,
  };
}

// GET /api/admin/sellers/:id/pos — read-only status + last 20 sync runs.
const getPosStatus = async (req, res) => {
  const seller = await Seller.findById(req.params.id).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const runs = await PosSyncRun.find({ seller: seller._id }).sort({ startedAt: -1 }).limit(20).lean();
  res.json({ posConnection: serializeConnection(seller), runs });
};

// PATCH /api/admin/sellers/:id/pos — owner only. `integrationKey` is
// optional: a call that only flips `enabled` or changes `baseUrl` leaves
// whatever key is already stored untouched.
const updatePosConnection = async (req, res) => {
  const { enabled, baseUrl, integrationKey, reason } = req.body;
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const before = serializeConnection(seller);

  if (baseUrl !== undefined) seller.posConnection.baseUrl = baseUrl;
  if (integrationKey) {
    seller.posConnection.encryptedKey = encrypt(integrationKey);
    seller.posConnection.keyLast4 = integrationKey.slice(-4);
  }
  if (enabled !== undefined) seller.posConnection.enabled = enabled;
  await seller.save();

  const after = serializeConnection(seller);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.pos.update',
    targetType: 'Seller',
    targetId: seller._id,
    before,
    after,
    summary: `${req.user.name} ${enabled === true ? 'enabled' : enabled === false ? 'disabled' : 'updated'} the POS connection for ${seller.name}. Reason: ${reason}`,
  });

  res.json({ posConnection: after });
};

module.exports = { getPosStatus, updatePosConnection };
