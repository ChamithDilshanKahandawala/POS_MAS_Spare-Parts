const SellerApplication = require('../models/SellerApplication');
const Seller = require('../models/Seller');
const { logAction } = require('../services/auditLog');
const { createInvite } = require('../services/invites');
const { clampLimit } = require('../utils/pagination');
const { readFile } = require('../services/storage');
const { generateUniqueSlug } = require('../services/sellerSlug');

const MAX_APPLICATIONS_LIMIT = 100;

// GET /api/admin/applications — queue, oldest first (the review brief's
// explicit ordering: the longest-waiting applicant is seen first).
const listApplications = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;

  const safeLimit = clampLimit(limit, 20, MAX_APPLICATIONS_LIMIT);
  const [applications, total] = await Promise.all([
    SellerApplication.find(query).sort({ createdAt: 1 }).skip((page - 1) * safeLimit).limit(safeLimit),
    SellerApplication.countDocuments(query),
  ]);

  res.json({ applications, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

// GET /api/admin/applications/:id
const getApplicationDetail = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  res.json({ application });
};

// GET /api/admin/applications/:id/documents/:type — streams the raw
// bytes of one uploaded document (document viewer). `path` never comes
// from the client — it's looked up on the application record, so this
// can't be used to read an arbitrary file off disk.
const getApplicationDocument = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });

  const document = application.documents.find((d) => d.type === req.params.type);
  if (!document) return res.status(404).json({ message: 'Document not found' });

  const buffer = readFile(document.path);
  res.set('Content-Type', document.mimetype);
  res.send(buffer);
};

// PATCH /api/admin/applications/:id/checklist
const updateChecklist = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });

  const before = application.checklist.toObject();
  Object.assign(application.checklist, req.body);
  await application.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'application.checklist.update',
    targetType: 'SellerApplication',
    targetId: application._id,
    before: { checklist: before },
    after: { checklist: application.checklist.toObject() },
    summary: `Updated review checklist for ${application.storeName}'s application`,
  });

  res.json({ application });
};

// POST /api/admin/applications/:id/notes
const addNote = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });

  application.notes.push({ author: req.user._id, authorName: req.user.name, text: req.body.text });
  await application.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'application.note.add',
    targetType: 'SellerApplication',
    targetId: application._id,
    summary: `Added a note to ${application.storeName}'s application`,
  });

  res.status(201).json({ application });
};

// POST /api/admin/applications/:id/request-info — status -> info_requested.
// No real email provider in dev; the "email" is a console.log, same as
// OTP codes and invite links.
const requestInfo = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  if (['approved', 'rejected'].includes(application.status)) {
    return res.status(409).json({ message: `Cannot request info: application is already ${application.status}` });
  }

  const before = application.status;
  application.status = 'info_requested';
  application.infoRequestedMessage = req.body.message;
  await application.save();

  console.log(`[email:dev] To: ${application.email} — More information needed for your Apexora seller application: ${req.body.message}`);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'application.request_info',
    targetType: 'SellerApplication',
    targetId: application._id,
    before: { status: before },
    after: { status: application.status },
    summary: `Requested more info from ${application.storeName}: ${req.body.message}`,
  });

  res.json({ application });
};

// POST /api/admin/applications/:id/approve — creates the real Seller
// record and an owner invite (role: seller_owner) in one step; the
// application itself stays as the historical record of what was
// submitted (see models/Seller.js's header comment).
const approveApplication = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  if (['approved', 'rejected'].includes(application.status)) {
    return res.status(409).json({ message: `Cannot approve: application is already ${application.status}` });
  }

  const slug = await generateUniqueSlug(application.storeName);
  const seller = await Seller.create({
    name: application.storeName,
    slug,
    legalName: application.legalName,
    brNumber: application.brNumber,
    status: 'in_review',
    district: application.district,
    ownerName: application.ownerName,
    nic: application.nic,
    phone: application.phone,
    email: application.email,
    address: application.address,
    categories: application.categories,
    documents: application.documents,
    application: application._id,
  });

  application.status = 'approved';
  application.approvedSeller = seller._id;
  await application.save();

  const { token } = await createInvite({
    email: application.email,
    role: 'seller_owner',
    sellerId: seller._id,
    invitedBy: req.user,
  });
  console.log(`[email:dev] To: ${application.email} — Your Apexora seller application was approved! Accept your invite: /invite/${token}`);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'application.approve',
    targetType: 'SellerApplication',
    targetId: application._id,
    before: { status: 'new' },
    after: { status: 'approved', sellerId: seller._id },
    summary: `Approved ${application.storeName}'s application; created seller and sent owner invite`,
  });

  res.json({ application, seller });
};

// POST /api/admin/applications/:id/reject
const rejectApplication = async (req, res) => {
  const application = await SellerApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  if (['approved', 'rejected'].includes(application.status)) {
    return res.status(409).json({ message: `Cannot reject: application is already ${application.status}` });
  }

  const before = application.status;
  application.status = 'rejected';
  application.rejectedReason = req.body.reason;
  await application.save();

  console.log(`[email:dev] To: ${application.email} — Your Apexora seller application was not approved: ${req.body.reason}`);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'application.reject',
    targetType: 'SellerApplication',
    targetId: application._id,
    before: { status: before },
    after: { status: application.status },
    summary: `Rejected ${application.storeName}'s application: ${req.body.reason}`,
  });

  res.json({ application });
};

module.exports = {
  listApplications,
  getApplicationDetail,
  getApplicationDocument,
  updateChecklist,
  addNote,
  requestInfo,
  approveApplication,
  rejectApplication,
};
