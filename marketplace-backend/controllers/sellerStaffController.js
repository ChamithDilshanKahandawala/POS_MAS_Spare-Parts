const SellerMember = require('../models/SellerMember');
const Seller = require('../models/Seller');
const Invite = require('../models/Invite');
const { logAction } = require('../services/auditLog');
const { createInvite } = require('../services/invites');

// GET /api/seller/staff — owner only (route-gated). Staff members +
// still-pending invites for this store, same pattern as
// controllers/platformStaffController.js's listPlatformStaff.
const listStaff = async (req, res) => {
  const [members, pendingInvites] = await Promise.all([
    SellerMember.find({ seller: req.sellerId, status: 'active' }).populate('user', 'name email'),
    Invite.find({ seller: req.sellerId, role: 'seller_staff', status: 'pending', expiresAt: { $gt: new Date() } }).select('email expiresAt createdAt'),
  ]);
  res.json({ members, pendingInvites });
};

// POST /api/seller/staff/invite — owner only.
const inviteStaff = async (req, res) => {
  const { email } = req.body;

  const seller = await Seller.findById(req.sellerId).select('name');
  const members = await SellerMember.find({ seller: req.sellerId, status: 'active' }).populate('user', 'email');
  if (members.some((m) => m.user?.email === email)) {
    return res.status(409).json({ message: 'This person is already on your team' });
  }

  const { invite, token } = await createInvite({ email, role: 'seller_staff', sellerId: req.sellerId, invitedBy: req.user });
  console.log(`[email:dev] To: ${email} — You've been invited to join ${seller.name} on Apexora: /invite/${token}`);

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'seller.staff.invite',
    targetType: 'Seller',
    targetId: req.sellerId,
    summary: `${req.user.name} invited ${email} to the team`,
  });

  res.status(201).json({ message: 'Invite sent', expiresAt: invite.expiresAt });
};

// DELETE /api/seller/staff/:id — owner only. :id is the SellerMember row
// id (not a user id) — scoped to req.sellerId so an owner can never
// remove a membership row belonging to a different store.
const removeStaff = async (req, res) => {
  const member = await SellerMember.findOne({ _id: req.params.id, seller: req.sellerId }).populate('user', 'name email');
  if (!member) return res.status(404).json({ message: 'Not found' });

  if (member.user._id.equals(req.user._id)) {
    return res.status(403).json({ message: "You can't remove yourself" });
  }

  member.status = 'removed';
  await member.save();

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'seller.staff.remove',
    targetType: 'Seller',
    targetId: req.sellerId,
    summary: `${req.user.name} removed ${member.user.name} from the team`,
  });

  res.json({ message: 'Removed' });
};

module.exports = { listStaff, inviteStaff, removeStaff };
