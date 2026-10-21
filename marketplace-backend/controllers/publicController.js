const bcrypt = require('bcryptjs');
const SellerApplication = require('../models/SellerApplication');
const SellerMember = require('../models/SellerMember');
const Seller = require('../models/Seller');
const User = require('../models/User');
const { detectFileType } = require('../utils/fileType');
const { saveFile } = require('../services/storage');
const { findInviteByToken } = require('../services/invites');
const { notify } = require('../services/notifications');

const REQUIRED_DOC_FIELDS = ['brCertificate', 'nicFront', 'nicBack'];
const DOC_FIELD_TO_TYPE = { brCertificate: 'br_certificate', nicFront: 'nic_front', nicBack: 'nic_back' };

// POST /api/public/seller-applications — multipart. Rate-limited (see
// routes/publicRoutes.js). Every file is re-identified from its real
// bytes (utils/fileType.js) — a renamed .exe/.html is rejected here
// regardless of what extension or Content-Type it arrived with.
const submitApplication = async (req, res) => {
  const files = req.files || {};
  for (const field of REQUIRED_DOC_FIELDS) {
    if (!files[field] || !files[field][0]) {
      return res.status(400).json({ message: `Missing required document: ${field}` });
    }
  }

  const documents = [];
  for (const field of REQUIRED_DOC_FIELDS) {
    const file = files[field][0];
    const detected = detectFileType(file.buffer);
    if (!detected) {
      return res.status(400).json({ message: `${field}: file is not a valid PDF, JPG, or PNG` });
    }
    const storedPath = saveFile(file.buffer, detected.ext);
    documents.push({
      type: DOC_FIELD_TO_TYPE[field],
      filename: file.originalname,
      path: storedPath,
      mimetype: detected.type,
      size: file.size,
    });
  }

  const categories = typeof req.body.categories === 'string'
    ? req.body.categories.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const application = await SellerApplication.create({
    storeName: req.body.storeName,
    legalName: req.body.legalName,
    brNumber: req.body.brNumber,
    ownerName: req.body.ownerName,
    nic: req.body.nic,
    phone: req.body.phone,
    email: req.body.email,
    address: req.body.address,
    district: req.body.district,
    categories,
    documents,
  });

  res.status(201).json({ id: application._id, status: application.status });
};

// GET /api/public/invites/:token — lets the console check an invite's
// validity (and show who/what it's for) BEFORE rendering the set-
// password form, rather than only discovering it's expired/used on
// submit. Never reveals anything if invalid — same 404 either way.
const getInvite = async (req, res) => {
  const { token } = req.params;
  const invite = await findInviteByToken(token);
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(404).json({ message: 'Invite not found or expired' });
  }

  let sellerName = null;
  if (invite.seller) {
    const seller = await Seller.findById(invite.seller).select('name').lean();
    sellerName = seller?.name || null;
  }

  const existingUser = await User.exists({ email: invite.email });

  res.json({
    email: invite.email,
    role: invite.role,
    sellerName,
    needsPassword: !existingUser, // an existing account just needs to log in normally
  });
};

// POST /api/public/invites/:token/accept — shared by platform-staff,
// seller-owner, and seller-staff invites (models/Invite.js's generalized
// shape); creates the User if the email is new, or reuses an existing
// one, then grants EXACTLY the role stored on the invite — never
// anything the client sends, so an invite can't be used to grant a
// different role than the one that was actually issued.
const acceptInvite = async (req, res) => {
  const { token } = req.params;
  const { name, password } = req.body;

  const invite = await findInviteByToken(token);
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(404).json({ message: 'Invite not found or expired' });
  }

  let user = await User.findOne({ email: invite.email });
  if (!user) {
    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required for a new account' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({ name, email: invite.email, password: passwordHash, isActive: true });
  }

  if (invite.role === 'platform_staff') {
    user.platformRole = user.platformRole === 'platform_owner' ? 'platform_owner' : 'platform_staff';
    await user.save();
  } else if (invite.role === 'seller_owner' || invite.role === 'seller_staff') {
    await SellerMember.findOneAndUpdate(
      { user: user._id, seller: invite.seller },
      { user: user._id, seller: invite.seller, role: invite.role, status: 'active' },
      { upsert: true }
    );

    const seller = await Seller.findById(invite.seller).select('name').lean();

    if (invite.role === 'seller_owner') {
      await notify({
        userId: user._id,
        type: 'application.approved',
        title: `Welcome to Apexora, ${seller?.name || ''}!`.trim(),
        body: 'Your seller application was approved and your store is ready to set up.',
        link: '/seller',
      });
    } else {
      const owners = await SellerMember.find({ seller: invite.seller, role: 'seller_owner', status: 'active' }).select('user').lean();
      await Promise.all(owners.map((o) => notify({
        userId: o.user,
        type: 'staff.invite_accepted',
        title: `${user.name} joined ${seller?.name || 'your store'}`,
        body: `${user.name} (${user.email}) accepted your staff invite.`,
        link: '/seller/staff',
      })));
    }
  }

  invite.status = 'accepted';
  invite.acceptedBy = user._id;
  await invite.save();

  res.json({ message: 'Invite accepted', role: invite.role, sellerId: invite.seller });
};

module.exports = { submitApplication, getInvite, acceptInvite };
