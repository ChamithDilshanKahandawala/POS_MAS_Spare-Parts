const Product = require('../models/Product');
const { executeProductSearch } = require('../services/productSearchService');
const { normalizeProductPayload } = require('../utils/productSearch');

// GET /api/products  (with search, category filter, pagination)
const getProducts = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20, lowStock } = req.query;

    if (search && String(search).trim()) {
      const result = await executeProductSearch({
        query: search,
        category,
        lowStock,
        page,
        limit,
      });

      const products = result.products.map((product) => {
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
          delete product.buying_price;
        }
        delete product.search_text;
        delete product.search_terms;
        delete product.search_ngrams;
        return product;
      });

      return res.json({ ...result, products });
    }

    const query = { is_active: true };

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
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        delete p.buying_price;
      }
      delete p.search_text;
      delete p.search_terms;
      delete p.search_ngrams;
      return p;
    });

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/products/search  (smart autocomplete/search)
const searchProducts = async (req, res) => {
  try {
    const { q = '', category = 'All', page = 1, limit = 10, lowStock } = req.query;
    const result = await executeProductSearch({
      query: q,
      category,
      lowStock,
      page,
      limit,
    });

    const products = result.products.map((product) => {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        delete product.buying_price;
      }
      delete product.search_text;
      delete product.search_terms;
      delete product.search_ngrams;
      return product;
    });

    res.json({ ...result, products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const rawProduct = await Product.findById(req.params.id).lean();
    if (!rawProduct) return res.status(404).json({ message: 'Product not found' });
    
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
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
    const product = await Product.create(normalizeProductPayload(req.body));
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.set(normalizeProductPayload(req.body));
    await product.save();
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

module.exports = { getProducts, searchProducts, getProductById, createProduct, updateProduct, deleteProduct, getLowStockAlerts };
