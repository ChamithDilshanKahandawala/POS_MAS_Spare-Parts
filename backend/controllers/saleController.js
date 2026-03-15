const Sale = require('../models/Sale');
const Product = require('../models/Product');

// POST /api/sales  - Create a new sale
const createSale = async (req, res) => {
  try {
    const { items, total_discount, payment_method, customer_name, customer_phone, notes, sale_source, shipping_address } = req.body;

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
      sale_source: sale_source || 'shop',
      customer_name: customer_name || (req.user.role === 'customer' ? req.user.name : 'Walk-in Customer'),
      customer_phone: customer_phone || '',
      customer: req.user.role === 'customer' ? req.user._id : undefined,
      order_status: sale_source === 'online' ? 'Pending' : 'Delivered',
      shipping_address: shipping_address || '',
      cashier: req.user.role !== 'customer' ? req.user._id : undefined,
      cashier_name: req.user.role !== 'customer' ? req.user.name : undefined,
      shop: req.user.shop || 'Main Branch',
      notes: notes || '',
    });

    if (req.user.role === 'customer') {
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user._id, { $push: { orderHistory: sale._id } });
    }

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales
const getSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, from, to, payment_method, sale_source } = req.query;
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
    if (sale_source) query.sale_source = sale_source;

    const total = await Sale.countDocuments(query);
    const rawSales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const sales = rawSales.map(sale => {
      if (req.user && req.user.role !== 'admin') {
        delete sale.total_profit;
        delete sale.total_cost;
        if (sale.items) {
          sale.items = sale.items.map(item => {
            delete item.buying_price;
            delete item.line_profit;
            return item;
          });
        }
      }
      return sale;
    });

    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/my-orders
const getMyOrders = async (req, res) => {
  try {
    const rawSales = await Sale.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const orders = rawSales.map(sale => {
      delete sale.total_profit;
      delete sale.total_cost;
      if (sale.items) {
        sale.items = sale.items.map(item => {
          delete item.buying_price;
          delete item.line_profit;
          return item;
        });
      }
      return sale;
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/:id
const getSaleById = async (req, res) => {
  try {
    const rawSale = await Sale.findById(req.params.id).lean();
    if (!rawSale) return res.status(404).json({ message: 'Sale not found' });
    
    if (req.user && req.user.role !== 'admin') {
      delete rawSale.total_profit;
      delete rawSale.total_cost;
      if (rawSale.items) {
        rawSale.items = rawSale.items.map(item => {
          delete item.buying_price;
          delete item.line_profit;
          return item;
        });
      }
    }
    
    res.json(rawSale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/sales/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { order_status } = req.body;
    if (!order_status) return res.status(400).json({ message: 'Missing status' });

    const sale = await Sale.findByIdAndUpdate(req.params.id, { order_status }, { new: true });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/analytics/summary  (daily | weekly | monthly | yearly)
const getAnalytics = async (req, res) => {
  try {
    const { period, sale_source } = req.query;
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

    const matchStage = { createdAt: { $gte: startDate } };
    if (sale_source && sale_source !== 'all') {
      matchStage.sale_source = sale_source;
    }

    // Summary totals
    const result = await Sale.aggregate([
      { $match: matchStage },
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
      { $match: matchStage },
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
      { $match: matchStage },
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
      { $match: matchStage },
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
      { $match: matchStage },
      {
        $group: {
          _id: '$payment_method',
          count: { $sum: 1 },
          revenue: { $sum: '$total_amount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const responseData = {
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
    };

    if (req.user && req.user.role !== 'admin') {
      delete responseData.summary.total_profit;
      delete responseData.summary.total_cost;
      
      responseData.chartData = responseData.chartData.map(d => {
        delete d.profit;
        delete d.cost;
        return d;
      });
      
      responseData.categoryData = responseData.categoryData.map(d => {
        delete d.profit;
        return d;
      });
      
      responseData.topProducts = responseData.topProducts.map(d => {
        delete d.profit;
        return d;
      });
    }

    res.json(responseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createSale,  getSales,
  getMyOrders,
  getSaleById,
  updateOrderStatus,
  getAnalytics,
};
