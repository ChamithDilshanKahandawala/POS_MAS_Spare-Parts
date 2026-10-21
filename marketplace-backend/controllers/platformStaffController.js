const User = require('../models/User');
const Invite = require('../models/Invite');
const { logAction } = require('../services/auditLog');
const { createInvite } = require('../services/invites');

// GET /api/admin/platform-staff — owner only. Staff + owners, plus any
// still-pending platform_staff invites so the owner can see who's been
// invited but hasn't accepted yet.
const listPlatformStaff = async (req, res) => {
  const [staff, pendingInvites] = await Promise.all([
    User.find({ platformRole: { $in: ['platform_staff', 'platform_owner'] } }).select('name email platformRole createdAt').lean(),
    Invite.find({ role: 'platform_staff', status: 'pending', expiresAt: { $gt: new Date() } }).select('email expiresAt createdAt').lean(),
  ]);
  res.json({ staff, pendingInvites });
};

// POST /api/admin/platform-staff/invite — owner only. Link is logged to
// the console in dev (no email provider wired up yet — same pattern as
// OTP codes and application-decision notifications).
const inviteStaff = async (req, res) => {
  const { email } = req.body;

  const existing = await User.findOne({ email }).lean();
  if (existing && ['platform_staff', 'platform_owner'].includes(existing.platformRole)) {
    return res.status(409).json({ message: 'This person is already platform staff' });
  }

  const { invite, token } = await createInvite({ email, role: 'platform_staff', invitedBy: req.user });
  console.log(`[email:dev] To: ${email} — You've been invited to join Apexora platform staff: /invite/${token}`);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'platform_staff.invite',
    targetType: 'Invite',
    targetId: invite._id,
    summary: `Invited ${email} to platform staff`,
  });

  res.status(201).json({ message: 'Invite sent', expiresAt: invite.expiresAt });
};

// PATCH /api/admin/platform-staff/:id/role — owner only. Only none <->
// platform_staff is a valid target here; platform_owner is never
// assignable through this route (there's no "promote to owner" flow in
// this milestone), and an owner can't demote themselves (self-protection,
// same reasoning as remove below).
const changeRole = async (req, res) => {
  const { role } = req.body;
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  if (target._id.equals(req.user._id)) {
    return res.status(403).json({ message: "You can't change your own role" });
  }
  if (target.platformRole === 'platform_owner') {
    return res.status(403).json({ message: "Can't change another owner's role" });
  }

  const before = target.platformRole;
  target.platformRole = role;
  await target.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'platform_staff.role.change',
    targetType: 'User',
    targetId: target._id,
    before: { platformRole: before },
    after: { platformRole: target.platformRole },
    summary: `Changed ${target.name}'s platform role: ${before} → ${target.platformRole}`,
  });

  res.json({ user: { id: target._id, name: target.name, email: target.email, platformRole: target.platformRole } });
};

// DELETE /api/admin/platform-staff/:id — owner only. Removing staff just
// means dropping their platform access (platformRole -> 'none'); their
// User account and any seller memberships are untouched.
const removeStaff = async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  if (target._id.equals(req.user._id)) {
    return res.status(403).json({ message: "You can't remove yourself" });
  }
  if (target.platformRole === 'platform_owner') {
    return res.status(403).json({ message: "Can't remove another owner" });
  }

  const before = target.platformRole;
  target.platformRole = 'none';
  await target.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'platform_staff.remove',
    targetType: 'User',
    targetId: target._id,
    before: { platformRole: before },
    after: { platformRole: 'none' },
    summary: `Removed ${target.name} from platform staff`,
  });

  res.json({ message: 'Removed' });
};

module.exports = { listPlatformStaff, inviteStaff, changeRole, removeStaff };
