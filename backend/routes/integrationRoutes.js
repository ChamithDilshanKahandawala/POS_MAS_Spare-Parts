const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Product = require('../models/Product');
const integrationAuth = require('../middleware/integrationAuth');

// Server-to-server only, but still rate-limited — a leaked or
// misconfigured key shouldn't be able to hammer the POS database.
const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

const MAX_LIMIT = 200;

// Enforced via .select() on the query itself — buying_price/cost/profit/
// supplier/barcode/description/etc. never leave the database for this
// route at all, not just stripped from the response afterward. `_id` is
// included by Mongoose by default even though it's not named here.
const FIELD_WHITELIST = 'sku_code name brand category sub_category selling_price stock_quantity unit updatedAt is_active';

// GET /api/integration/products — read-only product feed for the
// Apexora marketplace's POS-connected sellers (Milestone 4). Never
// writes anything to the POS database. Price is converted from the
// POS's stored Rupees to integer cents here, matching the marketplace's
// own priceCents convention, so the caller never has to guess the unit.
router.get('/products', integrationLimiter, integrationAuth, async (req, res) => {
  try {
    const { updatedSince, page = 1, limit = 50 } = req.query;

    const query = {};
    if (updatedSince) {
      const since = new Date(updatedSince);
      if (Number.isNaN(since.getTime())) {
        return res.status(400).json({ message: 'updatedSince must be a valid ISO date' });
      }
      query.updatedAt = { $gte: since };
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_LIMIT);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(FIELD_WHITELIST)
        .sort({ updatedAt: 1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      products: products.map((p) => ({
        id: p._id,
        sku_code: p.sku_code,
        name: p.name,
        brand: p.brand,
        category: p.category,
        sub_category: p.sub_category,
        selling_price: Math.round(p.selling_price * 100),
        stock_quantity: p.stock_quantity,
        unit: p.unit,
        updatedAt: p.updatedAt,
        active: p.is_active,
      })),
      total,
      page: safePage,
      pages: Math.ceil(total / safeLimit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
