const Supplier = require('../models/Supplier');

const getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [
      { company_name: { $regex: search, $options: 'i' } },
      { contact_person: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.json({ suppliers, total: suppliers.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
