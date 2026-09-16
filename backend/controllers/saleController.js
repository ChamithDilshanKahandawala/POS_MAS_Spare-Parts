const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { getFiscalMonthRange } = require('../utils/fiscalDate');
const { getColomboMidnightUTC } = require('../utils/colomboDate');
const { clampLimit } = require('../utils/pagination');

// WebOrdersPage/WhatsAppOrdersPage request up to 200; SalesHistoryPage uses 50.
const MAX_SALES_LIMIT = 200;

// Lets a handler bail out mid-transaction with the same status code the
// old code used to send directly via res.status(...).json(...).
class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}



const formatColomboTime = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d).replace('T', ' ');
};

// Removes profit/cost fields that only admins/super_admins should see. Shared
// by getSales, getSaleById, and getSaleReceipt so staff-visible sale data
// stays consistent across all three endpoints.
const stripProfitFields = (sale) => {
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
};

const formatReceiptData = (sale) => {
  const data = sale.toObject ? sale.toObject() : sale;
  const shouldKickDrawer = data.payment_method === 'Cash';
  const change = shouldKickDrawer ? Math.max(0, (data.paid_amount || 0) - (data.total_amount || 0)) : 0;
  
  return {
    ...data,
    createdAt: formatColomboTime(data.createdAt),
    change
  };
};

// POST /api/sales  - Create a new sale
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  const { idempotencyKey } = req.body;
  let createdSale;
  let stockUpdates;
  let isDuplicate = false;

  try {
    // Fast path: a prior request with this same key already committed a
    // sale (e.g. the network dropped the first response before the client
    // saw it, and the client retried) — return that sale instead of
    // creating a second one.
    if (idempotencyKey) {
      const existing = await Sale.findOne({ idempotency_key: idempotencyKey });
      if (existing) {
        createdSale = existing;
        isDuplicate = true;
      }
    }

    if (!isDuplicate) await session.withTransaction(async () => {
      const { items, total_discount, payment_method, customer_name, customer_phone,customer_details, notes, sale_source, shipping_address, shipping_cost_charged, actual_shipping_cost, tracking_number, cod_amount, paid_amount, koko_charge, koko_percentage } = req.body;

      if (!items || items.length === 0) {
        throw new RequestError(400, 'No items in cart');
      }

      if (tracking_number && tracking_number.trim() !== '') {
        const existingSale = await Sale.findOne({ tracking_number: tracking_number.trim() }).session(session);
        if (existingSale) {
          throw new RequestError(400, 'Tracking number already exists for another order');
        }
      }

      let subtotal = 0;
      let total_cost = 0;
      const saleItems = [];
      stockUpdates = []; // collect real-time stock changes

      for (const item of items) {
        const product = await Product.findById(item.product_id).session(session);
        if (!product) throw new RequestError(404, `Product not found: ${item.product_id}`);

        // Atomic check-and-decrement: only succeeds if enough stock remains at
        // the moment of the write, so two concurrent sales can never both pass.
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.product_id, stock_quantity: { $gte: item.quantity } },
          { $inc: { stock_quantity: -item.quantity } },
          { new: true, session }
        );
        if (!updatedProduct) throw new RequestError(400, `Insufficient stock for: ${product.name}`);

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

        // Track new stock level for real-time broadcast
        stockUpdates.push({
          productId: updatedProduct._id.toString(),
          newQuantity: updatedProduct.stock_quantity,
        });
      }

      const itemsTotalAfterItemDiscounts = saleItems.reduce((acc, i) => acc + i.line_total, 0);

      const billDiscount = total_discount || 0;
      const shipping_charged = Number(shipping_cost_charged) || 0;
      const actual_shipping = Number(actual_shipping_cost) || 0;

      const finalTotal = itemsTotalAfterItemDiscounts - billDiscount;
      const finalProfit = saleItems.reduce((acc, i) => acc + i.line_profit, 0) - billDiscount + shipping_charged - actual_shipping;

      // WhatsApp orders are handed over right at billing time — the tracking
      // number is added for reference, not because it's awaiting courier
      // dispatch — so mark them Delivered once a tracking number is given.
      // Online orders keep the original Shipped/Pending flow since those do
      // go through actual courier dispatch tracking.
      let order_status;
      if (sale_source === 'whatsapp') {
        order_status = tracking_number ? 'Delivered' : 'Pending';
      } else if (sale_source === 'online') {
        order_status = tracking_number ? 'Shipped' : 'Pending';
      } else {
        order_status = 'Delivered';
      }

      const [sale] = await Sale.create([{
        items: saleItems,
        subtotal,
        total_discount: billDiscount,
        shipping_cost_charged: shipping_charged,
        actual_shipping_cost: actual_shipping,
        cod_amount: Number(cod_amount) || 0,
        paid_amount: Number(paid_amount) || 0,
        koko_charge: Number(koko_charge) || 0,
        koko_percentage: Number(koko_percentage) || 0,
        total_amount: finalTotal,
        total_cost,
        total_profit: finalProfit,
        payment_method: payment_method || 'Cash',
        sale_source: sale_source || 'shop',
        customer_name: customer_name || (req.user.role === 'customer' ? req.user.name : 'Walk-in Customer'),
        customer_phone: customer_phone || '',
        customer_details: customer_details || '',
        customer: req.user.role === 'customer' ? req.user._id : undefined,
        order_status,
        shipping_address: shipping_address || '',
        cashier: req.user.role !== 'customer' ? req.user._id : undefined,
        cashier_name: req.user.role !== 'customer' ? req.user.name : undefined,
        shop: req.user.shop || 'Main Branch',
        notes: notes || '',
        tracking_number: tracking_number || '',
        idempotency_key: idempotencyKey || undefined,
      }], { session });

      if (req.user.role === 'customer') {
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.user._id, { $push: { orderHistory: sale._id } }, { session });
      }

      createdSale = sale;
    });

    // Emit Socket.io events only after the transaction has committed, and
    // only for a real new sale — a duplicate no-op made no stock change and
    // was already broadcast when the original request committed.
    if (!isDuplicate) {
      const io = req.app.get('io');
      if (io) {
        // Always broadcast stock changes so storefront updates in real-time
        io.emit('stock_updated', stockUpdates);

        // Notify POS dashboard of new online orders. Scoped to the 'staff'
        // room (see server.js) so customer/anonymous sockets never receive
        // it, and still strip profit/cost fields for the staff who do.
        if (createdSale.sale_source === 'online') {
          io.to('staff').emit('new_web_order', stripProfitFields(createdSale.toObject()));
        }
      }
    }

    const receiptData = formatReceiptData(createdSale);
    if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      stripProfitFields(receiptData);
    }

    // A duplicate is a successful no-op, not a new resource — 200, not 201.
    res.status(isDuplicate ? 200 : 201).json(receiptData);
  } catch (err) {
    // Two concurrent requests with the same brand-new key can both pass the
    // fast-path check above before either commits. The unique index on
    // idempotency_key then rejects the second insert — treat that the same
    // way as the fast path: return the sale the first request created
    // instead of erroring the second one out.
    if (err.code === 11000 && err.keyPattern?.idempotency_key) {
      const existing = await Sale.findOne({ idempotency_key: idempotencyKey });
      if (existing) {
        const receiptData = formatReceiptData(existing);
        if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
          stripProfitFields(receiptData);
        }
        return res.status(200).json(receiptData);
      }
    }
    res.status(err.statusCode || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/sales
const getSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, from, to, payment_method, sale_source, order_status } = req.query;
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
    if (order_status) query.order_status = order_status;

    const safeLimit = clampLimit(limit, 20, MAX_SALES_LIMIT);
    const total = await Sale.countDocuments(query);
    const rawSales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    const sales = rawSales.map(sale => {
      if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        stripProfitFields(sale);
      }
      return sale;
    });

    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
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
    
    if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      stripProfitFields(rawSale);
    }

    res.json(rawSale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/:id/receipt
const getSaleReceipt = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const receiptData = formatReceiptData(sale);
    if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      stripProfitFields(receiptData);
    }

    res.json(receiptData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/sales/:id/status
const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  let sale;
  const stockUpdates = [];

  try {
    await session.withTransaction(async () => {
      const { order_status, tracking_number, money_received } = req.body;
      if (!order_status) throw new RequestError(400, 'Missing status');

      if (tracking_number && tracking_number.trim() !== '') {
        const existingSale = await Sale.findOne({ tracking_number: tracking_number.trim(), _id: { $ne: req.params.id } }).session(session);
        if (existingSale) {
          throw new RequestError(400, 'Tracking number already exists for another order');
        }
      }

      const updateData = { order_status };
      if (tracking_number !== undefined) updateData.tracking_number = tracking_number;
      if (money_received !== undefined) updateData.money_received = Boolean(money_received);

      const oldSale = await Sale.findById(req.params.id).session(session);
      if (!oldSale) throw new RequestError(404, 'Sale not found');

      const isRevertedStatus = order_status === 'Cancelled' || order_status === 'Returned';

      if (isRevertedStatus && !oldSale.is_stock_restored) {
        for (const item of oldSale.items) {
          const product = await Product.findByIdAndUpdate(item.product, { $inc: { stock_quantity: item.quantity } }, { new: true, session });
          if (product) stockUpdates.push({ productId: product._id, newQuantity: product.stock_quantity });
        }
        updateData.is_stock_restored = true;
      } else if (!isRevertedStatus && oldSale.is_stock_restored) {
        for (const item of oldSale.items) {
          const product = await Product.findOneAndUpdate(
            { _id: item.product, stock_quantity: { $gte: item.quantity } },
            { $inc: { stock_quantity: -item.quantity } },
            { new: true, session }
          );
          if (!product) throw new RequestError(400, `Insufficient stock to re-apply: ${item.product_name}`);
          stockUpdates.push({ productId: product._id, newQuantity: product.stock_quantity });
        }
        updateData.is_stock_restored = false;
      }

      sale = await Sale.findByIdAndUpdate(req.params.id, updateData, { new: true, session });
    });

    if (stockUpdates.length > 0) {
      const io = req.app.get('io');
      if (io) io.emit('stock_updated', stockUpdates);
    }

    res.json(sale);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/sales/analytics/summary  (daily | weekly | monthly | yearly)
const getAnalytics = async (req, res) => {
  try {
    const { period, sale_source, from, to } = req.query;
    const now = new Date();
    let startDate;
    let endDate;
    let groupFormat;
    let groupLabel;

    if (period === 'custom' && (from || to)) {
      // Custom date range selected by the user
      startDate = from ? new Date(from) : new Date('2020-01-01');
      if (to) {
        endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
      }
      // Choose grouping granularity based on range length
      const daySpan = endDate ? (endDate - startDate) / (1000 * 60 * 60 * 24) : 9999;
      if (daySpan <= 2) {
        groupFormat = '%H:00';
        groupLabel = 'Hour';
      } else if (daySpan <= 62) {
        groupFormat = '%Y-%m-%d';
        groupLabel = 'Day';
      } else {
        groupFormat = '%Y-%m';
        groupLabel = 'Month';
      }
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      groupFormat = '%Y-%m-%d';
      groupLabel = 'Day';
    } else if (period === 'monthly') {
      // Fiscal month runs from the 11th of one month to the 10th of the next month.
      const fiscalRange = getFiscalMonthRange(now);
      startDate = fiscalRange.start;
      endDate = fiscalRange.end;
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
      // daily (today) — midnight in Asia/Colombo, not the server's own
      // timezone (Railway runs its containers in UTC, ~5.5h off).
      startDate = getColomboMidnightUTC(now);
      groupFormat = '%H:00';
      groupLabel = 'Hour';
    }

    const matchStage = {
      createdAt: { $gte: startDate },
      order_status: { $nin: ['Cancelled', 'Returned'] }
    };
    if (endDate) {
      matchStage.createdAt.$lte = endDate;
    }
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
          _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: 'Asia/Colombo' } },
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
      { $sort: { quantity: -1 } },
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

    if (req.user && (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
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

// DELETE /api/sales/:id (Super Admin only)
const deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  const stockUpdates = [];
  let sale;

  try {
    await session.withTransaction(async () => {
      sale = await Sale.findById(req.params.id).session(session);
      if (!sale) throw new RequestError(404, 'Sale not found');

      // Restore stock if not already restored
      if (!sale.is_stock_restored) {
        for (const item of sale.items) {
          const product = await Product.findByIdAndUpdate(item.product, { $inc: { stock_quantity: item.quantity } }, { new: true, session });
          if (product) stockUpdates.push({ productId: product._id, newQuantity: product.stock_quantity });
        }
      }

      await Sale.findByIdAndDelete(req.params.id).session(session);

      if (sale.customer) {
        const User = require('../models/User');
        await User.findByIdAndUpdate(sale.customer, { $pull: { orderHistory: sale._id } }, { session });
      }
    });

    if (stockUpdates.length > 0) {
      const io = req.app.get('io');
      if (io) io.emit('stock_updated', stockUpdates);
    }

    res.json({ message: 'Sale deleted and stock restored' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

module.exports = { createSale,  getSales,
  getMyOrders,
  getSaleById,
  getSaleReceipt,
  updateOrderStatus,
  getAnalytics,
  deleteSale,
};
