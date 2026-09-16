const Supplier = require('../models/Supplier');
const { pick } = require('../utils/pick');
const { escapeRegex } = require('../utils/productSearch');

// isActive is deliberately excluded — only ever changed through the
// dedicated delete route.
const SUPPLIER_FIELDS = ['company_name', 'contact_person', 'phone', 'email', 'address', 'outstanding_payment', 'categories', 'notes'];

const getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { company_name: { $regex: safeSearch, $options: 'i' } },
        { contact_person: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.json({ suppliers, total: suppliers.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(pick(req.body, SUPPLIER_FIELDS));
    res.status(201).json(supplier);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, pick(req.body, SUPPLIER_FIELDS), { new: true });
    if (!supplier) return res.status(404).json({ message: 'Not found' });
    res.json(supplier);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteSupplier = async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Supplier removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getSuppliers, createSupplier, updateSupplier, deleteSupplier };
