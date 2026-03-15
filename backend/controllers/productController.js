const Product = require('../models/Product');

// GET /api/products  (with search, category filter, pagination)
const getProducts = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20, lowStock } = req.query;
    const query = { is_active: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku_code: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'All') query.category = category;
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock_quantity', '$low_stock_threshold'] };
    }

    const total = await Product.countDocuments(query);
    const rawProducts = await Product.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const products = rawProducts.map(p => {
      if (!req.user || req.user.role !== 'admin') {
        delete p.buying_price;
      }
      return p;
    });

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const rawProduct = await Product.findById(req.params.id).lean();
    if (!rawProduct) return res.status(404).json({ message: 'Product not found' });
    
    if (!req.user || req.user.role !== 'admin') {
      delete rawProduct.buying_price;
    }
    
    res.json(rawProduct);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'SKU code already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/products/:id  (soft delete)
const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ message: 'Product removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/products/low-stock/alerts
const getLowStockAlerts = async (req, res) => {
  try {
    const products = await Product.find({
      is_active: true,
      $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] },
    }).sort({ stock_quantity: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getLowStockAlerts };
