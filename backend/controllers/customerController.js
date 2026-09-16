const Customer = require('../models/Customer');
const { pick } = require('../utils/pick');
const { escapeRegex } = require('../utils/productSearch');
const { clampLimit } = require('../utils/pagination');

// No frontend caller requests above the 50 default today; 100 gives headroom
// without inviting a full-collection dump.
const MAX_CUSTOMERS_LIMIT = 100;

// balance_due and isActive are deliberately excluded — balance_due is only
// ever changed through the atomic /credit endpoint (which enforces the
// credit limit), and isActive only through the dedicated delete route.
const CUSTOMER_FIELDS = ['name', 'phone', 'email', 'address', 'vehicle_plate', 'vehicle_type', 'credit_limit', 'discount_pct', 'notes'];

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
        { vehicle_plate: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const safeLimit = clampLimit(limit, 50, MAX_CUSTOMERS_LIMIT);
    const skip = (page - 1) * safeLimit;
    const [customers, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Customer.countDocuments(query),
    ]);
    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/customers/:id
const getCustomerById = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(c);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create(pick(req.body, CUSTOMER_FIELDS));
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, pick(req.body, CUSTOMER_FIELDS), { new: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Customer removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/customers/:id/credit  → add/pay credit
const updateCredit = async (req, res) => {
  try {
    const { amount, type } = req.body; // type: 'add' | 'pay'
    const numAmount = Number(amount);

    if (type === 'add') {
      // Atomic check-and-increment: the credit-limit check and the write happen
      // in one operation, so two concurrent requests can't both slip past the limit.
      const customer = await Customer.findOneAndUpdate(
        {
          _id: req.params.id,
          $expr: { $lte: [{ $add: ['$balance_due', numAmount] }, '$credit_limit'] },
        },
        { $inc: { balance_due: numAmount } },
        { new: true }
      );
      if (!customer) {
        const existing = await Customer.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Not found' });
        return res.status(400).json({ message: `Exceeds credit limit (Rs.${existing.credit_limit})` });
      }
      return res.json(customer);
    }

    // 'pay' — atomically clamp at 0 via an aggregation-pipeline update.
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      [{ $set: { balance_due: { $max: [0, { $subtract: ['$balance_due', numAmount] }] } } }],
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, updateCredit };
