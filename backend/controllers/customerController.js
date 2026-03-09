const Customer = require('../models/Customer');

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { vehicle_plate: { $regex: search, $options: 'i' } },
    ];
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Customer.countDocuments(query),
    ]);
    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
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
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Not found' });
    if (type === 'add') {
      if (customer.balance_due + amount > customer.credit_limit) {
        return res.status(400).json({ message: `Exceeds credit limit (Rs.${customer.credit_limit})` });
      }
      customer.balance_due += Number(amount);
    } else {
      customer.balance_due = Math.max(0, customer.balance_due - Number(amount));
    }
    await customer.save();
    res.json(customer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, updateCredit };
