const mongoose = require('mongoose');
const Return   = require('../models/Return');
const Sale     = require('../models/Sale');
const Product  = require('../models/Product');

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// POST /api/returns  — process a return
const createReturn = async (req, res) => {
  const session = await mongoose.startSession();
  let createdReturn;

  try {
    await session.withTransaction(async () => {
      const { sale_id, items, reason, refund_method } = req.body;
      if (!sale_id) throw new RequestError(400, 'sale_id is required');
      if (!items || items.length === 0) throw new RequestError(400, 'No items to return');

      const sale = await Sale.findById(sale_id).session(session);
      if (!sale) throw new RequestError(404, 'Original sale not found');

      // Sum what's already been returned for this sale, per product, so repeated
      // returns of the same item can't each be refunded/restocked independently.
      const priorReturns = await Return.find({ original_sale: sale_id }).session(session);
      const alreadyReturned = {};
      for (const ret of priorReturns) {
        for (const it of ret.items) {
          const key = it.product.toString();
          alreadyReturned[key] = (alreadyReturned[key] || 0) + it.quantity;
        }
      }

      let total_refund = 0;
      const returnItems = [];

      for (const item of items) {
        const saleItem = sale.items.find(i => i.product.toString() === item.product_id);
        if (!saleItem) throw new RequestError(400, `Item was not part of this sale: ${item.product_name}`);

        const returnedSoFar = alreadyReturned[item.product_id] || 0;
        const remaining = saleItem.quantity - returnedSoFar;
        if (item.quantity > remaining) {
          throw new RequestError(400, `Return qty exceeds remaining returnable qty for: ${saleItem.product_name} (already returned ${returnedSoFar} of ${saleItem.quantity})`);
        }
        alreadyReturned[item.product_id] = returnedSoFar + item.quantity;

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
        await Product.findByIdAndUpdate(saleItem.product, { $inc: { stock_quantity: item.quantity } }, { session });
      }

      const [ret] = await Return.create([{
        original_sale:    sale_id,
        invoice_number:   sale.invoice_number,
        items:            returnItems,
        total_refund,
        reason:           reason || '',
        refund_method:    refund_method || 'Cash',
        processed_by:     req.user._id,
        processed_by_name: req.user.name,
        stock_restocked:  true,
      }], { session });

      createdReturn = ret;
    });

    res.status(201).json(createdReturn);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/returns
const getReturns = async (req, res) => {
  try {
    const returns = await Return.find().sort({ createdAt: -1 }).limit(100);
    res.json({ returns, total: returns.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { createReturn, getReturns };
