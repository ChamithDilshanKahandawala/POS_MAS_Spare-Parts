const mongoose = require('mongoose');
const ContentBlock = require('../models/ContentBlock');
const { PAGE_SLUGS } = require('../models/ContentBlock');
const { processBanner } = require('../services/imageProcessing');
const { saveFile, deleteFile, readFile } = require('../services/storage');
const { logAction } = require('../services/auditLog');
const cache = require('../services/cache');

const PUBLIC_CACHE_KEY = 'content:public';

function view(block) {
  const b = block.toObject ? block.toObject() : block;
  return {
    _id: b._id, kind: b.kind, key: b.key, sortOrder: b.sortOrder,
    draft: { ...b.draft, imagePath: undefined, hasImage: !!b.draft?.imagePath },
    published: b.published ? { ...b.published, imagePath: undefined, hasImage: !!b.published.imagePath } : null,
    publishedAt: b.publishedAt, draftUpdatedAt: b.draftUpdatedAt,
    hasUnpublishedChanges: !b.publishedAt || (b.draftUpdatedAt && b.draftUpdatedAt > b.publishedAt),
  };
}

// Pages and the announcement always exist (created empty on first read) so
// the admin UI has one row per slot.
async function ensureFixedBlocks() {
  const fixed = [...PAGE_SLUGS.map((slug) => ({ kind: 'page', key: slug })), { kind: 'announcement', key: 'announcement' }];
  await ContentBlock.bulkWrite(fixed.map((f) => ({
    updateOne: { filter: f, update: { $setOnInsert: { ...f, draft: {} } }, upsert: true },
  })), { ordered: false });
}

// GET /api/admin/content
const listContent = async (req, res) => {
  await ensureFixedBlocks();
  const blocks = await ContentBlock.find({}).sort({ kind: 1, sortOrder: 1, createdAt: 1 }).lean();
  res.json({
    pages: PAGE_SLUGS.map((slug) => view(blocks.find((b) => b.kind === 'page' && b.key === slug))),
    announcement: view(blocks.find((b) => b.kind === 'announcement')),
    banners: blocks.filter((b) => b.kind === 'banner').map(view),
  });
};

const DRAFT_FIELDS = {
  page: ['title', 'body'],
  announcement: ['text', 'link', 'startsAt', 'endsAt'],
  banner: ['title', 'link', 'language', 'startsAt', 'endsAt'],
};

async function saveDraftFor(block, body, user) {
  for (const field of DRAFT_FIELDS[block.kind]) {
    if (body[field] !== undefined) block.draft[field] = body[field];
  }
  if (body.sortOrder !== undefined && block.kind === 'banner') block.sortOrder = body.sortOrder;
  block.draftUpdatedAt = new Date();
  block.draftUpdatedBy = user._id;
  await block.save();
  return block;
}

// PUT /api/admin/content/:id — save a draft (never visible to customers).
const saveDraft = async (req, res) => {
  const block = await ContentBlock.findById(req.params.id);
  if (!block) return res.status(404).json({ message: 'Content not found' });
  await saveDraftFor(block, req.body, req.user);
  res.json({ block: view(block) });
};

// POST /api/admin/content/banners
const createBanner = async (req, res) => {
  const last = await ContentBlock.findOne({ kind: 'banner' }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const block = new ContentBlock({ kind: 'banner', key: new mongoose.Types.ObjectId().toString(), sortOrder: (last?.sortOrder ?? -1) + 1, draft: {} });
  await saveDraftFor(block, req.body, req.user);
  await logAction({ actor: req.user, actorRole: req.user.platformRole, action: 'content.banner.create', targetType: 'ContentBlock', targetId: block._id, summary: `Created banner "${block.draft.title?.en || 'untitled'}"` });
  res.status(201).json({ block: view(block) });
};

// POST /api/admin/content/:id/image — banner image for the draft.
const uploadBannerImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const block = await ContentBlock.findOne({ _id: req.params.id, kind: 'banner' });
  if (!block) return res.status(404).json({ message: 'Banner not found' });
  const processed = await processBanner(req.file.buffer);
  if (!processed) return res.status(400).json({ message: 'File must be a real JPG, PNG, or WebP image' });

  const previous = block.draft.imagePath;
  block.draft.imagePath = await saveFile(processed.buffer, processed.ext, 'content');
  block.draftUpdatedAt = new Date();
  block.draftUpdatedBy = req.user._id;
  await block.save();
  if (previous && previous !== block.published?.imagePath) await deleteFile(previous);
  res.json({ block: view(block) });
};

function publishProblem(block) {
  const d = block.draft;
  if (block.kind === 'page' && (!d.title?.en?.trim() || !d.body?.en?.trim())) return 'Add an English title and body before publishing.';
  if (block.kind === 'announcement' && !d.text?.en?.trim()) return 'Add the English announcement text before publishing.';
  if (block.kind === 'banner' && (!d.imagePath || !d.title?.en?.trim())) return 'Add an image and an English headline before publishing.';
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) return 'The end date must be after the start date.';
  return null;
}

// POST /api/admin/content/:id/publish
const publish = async (req, res) => {
  const block = await ContentBlock.findById(req.params.id);
  if (!block) return res.status(404).json({ message: 'Content not found' });
  const problem = publishProblem(block);
  if (problem) return res.status(400).json({ message: problem });

  const oldImage = block.published?.imagePath;
  const wasPublished = !!block.published;
  block.published = block.draft.toObject();
  block.publishedAt = new Date();
  block.publishedBy = req.user._id;
  block.draftUpdatedAt = block.publishedAt;
  await block.save();
  if (oldImage && oldImage !== block.published.imagePath) await deleteFile(oldImage);
  cache.invalidate(PUBLIC_CACHE_KEY);

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'content.publish',
    targetType: 'ContentBlock', targetId: block._id,
    after: { kind: block.kind, key: block.key },
    summary: `${wasPublished ? 'Republished' : 'Published'} ${block.kind} "${block.kind === 'page' ? block.key : block.published.title?.en || block.published.text?.en || block.key}"`,
  });
  res.json({ block: view(block) });
};

// POST /api/admin/content/:id/unpublish — the storefront falls back to its
// built-in copy (pages, announcement) or simply drops the banner.
const unpublish = async (req, res) => {
  const block = await ContentBlock.findById(req.params.id);
  if (!block) return res.status(404).json({ message: 'Content not found' });
  if (!block.published) return res.status(409).json({ message: 'This is not published' });
  const oldImage = block.published.imagePath;
  block.published = null;
  block.publishedAt = null;
  await block.save();
  if (oldImage && oldImage !== block.draft.imagePath) await deleteFile(oldImage);
  cache.invalidate(PUBLIC_CACHE_KEY);
  await logAction({ actor: req.user, actorRole: req.user.platformRole, action: 'content.unpublish', targetType: 'ContentBlock', targetId: block._id, summary: `Unpublished ${block.kind} "${block.key}"` });
  res.json({ block: view(block) });
};

// DELETE /api/admin/content/:id — banners only; pages and the announcement
// are fixed slots (unpublish them instead).
const deleteBanner = async (req, res) => {
  const block = await ContentBlock.findOne({ _id: req.params.id, kind: 'banner' });
  if (!block) return res.status(404).json({ message: 'Banner not found' });
  for (const p of new Set([block.draft.imagePath, block.published?.imagePath].filter(Boolean))) await deleteFile(p);
  await block.deleteOne();
  cache.invalidate(PUBLIC_CACHE_KEY);
  await logAction({ actor: req.user, actorRole: req.user.platformRole, action: 'content.banner.delete', targetType: 'ContentBlock', targetId: block._id, summary: `Deleted banner "${block.draft.title?.en || block.key}"` });
  res.json({ message: 'Banner deleted' });
};

// GET /api/admin/content/:id/image?version=draft|published
const getAdminImage = async (req, res) => {
  const block = await ContentBlock.findOne({ _id: req.params.id, kind: 'banner' }).lean();
  const path = req.query.version === 'published' ? block?.published?.imagePath : block?.draft?.imagePath;
  if (!path) return res.status(404).json({ message: 'Not found' });
  res.set('Content-Type', 'image/jpeg');
  res.send(await readFile(path));
};

// ---------- Public ----------
const inWindow = (v, now) => (!v.startsAt || v.startsAt <= now) && (!v.endsAt || v.endsAt > now);

async function buildPublicContent(now = new Date()) {
  const blocks = await ContentBlock.find({ published: { $ne: null } }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const announcement = blocks.find((b) => b.kind === 'announcement' && inWindow(b.published, now));
  return {
    announcement: announcement ? { text: announcement.published.text, link: announcement.published.link } : null,
    banners: blocks.filter((b) => b.kind === 'banner' && inWindow(b.published, now)).map((b) => ({
      id: b._id, title: b.published.title, link: b.published.link, language: b.published.language,
      version: b.publishedAt.getTime(),
    })),
    pages: Object.fromEntries(blocks.filter((b) => b.kind === 'page').map((b) => [b.key, { title: b.published.title, body: b.published.body, updatedAt: b.publishedAt }])),
  };
}

// GET /api/public/content — cached for a minute (start/end windows are
// therefore honoured to within ~60 s); every publish clears it.
const getPublicContent = async (req, res) => {
  let content = cache.get(PUBLIC_CACHE_KEY);
  if (!content) {
    content = await buildPublicContent();
    cache.set(PUBLIC_CACHE_KEY, content);
  }
  res.set('Cache-Control', 'public, max-age=60');
  res.json(content);
};

// GET /api/public/content/banners/:id/image — published image only.
const getPublicBannerImage = async (req, res) => {
  const block = await ContentBlock.findOne({ _id: req.params.id, kind: 'banner', published: { $ne: null } }).select('published.imagePath').lean();
  if (!block?.published?.imagePath) return res.status(404).json({ message: 'Not found' });
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(await readFile(block.published.imagePath));
};

module.exports = {
  listContent, saveDraft, createBanner, uploadBannerImage, publish, unpublish, deleteBanner, getAdminImage,
  getPublicContent, getPublicBannerImage, buildPublicContent,
};
