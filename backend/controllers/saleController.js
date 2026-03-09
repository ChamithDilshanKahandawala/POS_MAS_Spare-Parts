const Sale = require('../models/Sale');
const Product = require('../models/Product');

// POST /api/sales  - Create a new sale
const createSale = async (req, res) => {
  try {
    const { items, total_discount, payment_method, customer_name, customer_phone, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in cart' });
    }

    let subtotal = 0;
    let total_cost = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.product_id}` });
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for: ${product.name}` });
      }

      const lineDiscount = item.discount || 0;
      const effectivePrice = product.selling_price - lineDiscount;
      const line_total = effectivePrice * item.quantity;
      const line_profit = (effectivePrice - product.buying_price) * item.quantity;

      subtotal += product.selling_price * item.quantity;
      total_cost += product.buying_price * item.quantity;

      saleItems.push({
        product: product._id,
        product_name: product.name,
        sku_code: product.sku_code,
        quantity: item.quantity,
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        discount: lineDiscount,
        line_total,
        line_profit,
      });

      await Product.findByIdAndUpdate(product._id, {
        $inc: { stock_quantity: -item.quantity },
      });
    }

    const billDiscount = total_discount || 0;
    const itemsTotalAfterItemDiscounts = saleItems.reduce((acc, i) => acc + i.line_total, 0);
    const finalTotal = itemsTotalAfterItemDiscounts - billDiscount;
    const finalProfit = saleItems.reduce((acc, i) => acc + i.line_profit, 0) - billDiscount;

    const sale = await Sale.create({
      items: saleItems,
      subtotal,
      total_discount: billDiscount,
      total_amount: finalTotal,
      total_cost,
      total_profit: finalProfit,
      payment_method: payment_method || 'Cash',
      customer_name: customer_name || 'Walk-in Customer',
      customer_phone: customer_phone || '',
      cashier: req.user._id,
      cashier_name: req.user.name,
      shop: req.user.shop || 'Main Branch',
      notes: notes || '',
    });

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales
const getSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, from, to, payment_method } = req.query;
    const query = {};

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }
    if (payment_method) query.payment_method = payment_method;

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/:id
const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/analytics/summary  (daily | weekly | monthly | yearly)
const getAnalytics = async (req, res) => {
  try {
    const { period } = req.query;
    const now = new Date();
    let startDate;
    let groupFormat;
    let groupLabel;

    if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      groupFormat = '%Y-%m-%d';
      groupLabel = 'Day';
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      groupFormat = '%Y-%m-%d';
      groupLabel = 'Day';
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 current year
      groupFormat = '%Y-%m';
      groupLabel = 'Month';
    } else if (period === 'alltime') {
      startDate = new Date('2020-01-01');
      groupFormat = '%Y-%m';
      groupLabel = 'Month';
    } else {
      // daily (today)
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      groupFormat = '%H:00';
      groupLabel = 'Hour';
    }

    // Summary totals
    const result = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: '$total_amount' },
          total_profit: { $sum: '$total_profit' },
          total_cost: { $sum: '$total_cost' },
          total_transactions: { $sum: 1 },
          avg_transaction: { $avg: '$total_amount' },
          total_discount: { $sum: '$total_discount' },
        },
      },
    ]);

    // Time-series chart data
    const chartData = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          revenue: { $sum: '$total_amount' },
          profit: { $sum: '$total_profit' },
          cost: { $sum: '$total_cost' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Category-wise breakdown
    const categoryData = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productInfo.category',
          revenue: { $sum: '$items.line_total' },
          profit: { $sum: '$items.line_profit' },
          quantity: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Top selling products
    const topProducts = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product_name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.line_total' },
          profit: { $sum: '$items.line_profit' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Payment method breakdown
    const paymentData = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$payment_method',
          count: { $sum: 1 },
          revenue: { $sum: '$total_amount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    res.json({
      summary: result[0] || {
        total_revenue: 0, total_profit: 0, total_cost: 0,
        total_transactions: 0, avg_transaction: 0, total_discount: 0,
      },
      chartData,
      categoryData,
      topProducts,
      paymentData,
      period,
      startDate,
      groupLabel,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createSale, getSales, getSaleById, getAnalytics };
