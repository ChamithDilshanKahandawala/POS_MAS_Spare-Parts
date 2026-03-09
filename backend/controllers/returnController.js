const Return   = require('../models/Return');
const Sale     = require('../models/Sale');
const Product  = require('../models/Product');

// POST /api/returns  — process a return
const createReturn = async (req, res) => {
  try {
    const { sale_id, items, reason, refund_method } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ message: 'No items to return' });

    const sale = await Sale.findById(sale_id);
    if (!sale) return res.status(404).json({ message: 'Original sale not found' });

    let total_refund = 0;
    const returnItems = [];

    for (const item of items) {
      const saleItem = sale.items.find(i => i.product.toString() === item.product_id && i.quantity >= item.quantity);
      if (!saleItem) return res.status(400).json({ message: `Return qty exceeds sold qty for: ${item.product_name}` });

      const line_total = saleItem.selling_price * item.quantity;
      total_refund += line_total;

      returnItems.push({
        product:      saleItem.product,
        product_name: saleItem.product_name,
        sku_code:     saleItem.sku_code,
        quantity:     item.quantity,
        unit_price:   saleItem.selling_price,
        line_total,
      });

      // Restock
      await Product.findByIdAndUpdate(saleItem.product, { $inc: { stock_quantity: item.quantity } });
    }

    const ret = await Return.create({
      original_sale:    sale_id,
      invoice_number:   sale.invoice_number,
      items:            returnItems,
      total_refund,
      reason:           reason || '',
      refund_method:    refund_method || 'Cash',
      processed_by:     req.user._id,
      processed_by_name: req.user.name,
      stock_restocked:  true,
    });

    res.status(201).json(ret);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/returns
const getReturns = async (req, res) => {
  try {
    const returns = await Return.find().sort({ createdAt: -1 }).limit(100);
    res.json({ returns, total: returns.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { createReturn, getReturns };
