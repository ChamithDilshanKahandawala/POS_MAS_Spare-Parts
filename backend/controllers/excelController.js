const Product = require('../models/Product');
const XLSX    = require('xlsx');
const multer  = require('multer');
const path    = require('path');

// Multer — memory storage (no disk write needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only Excel/CSV files allowed'));
  },
});

// POST /api/products/import  — Bulk upload via Excel
const importProducts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) return res.status(400).json({ message: 'Excel file is empty' });

    let created = 0, updated = 0, errors = [];

    for (const row of rows) {
      try {
        const data = {
          sku_code:           String(row['SKU'] || row['sku_code'] || '').trim(),
          name:               String(row['Name'] || row['name'] || '').trim(),
          category:           String(row['Category'] || row['category'] || 'Three-Wheel').trim(),
          buying_price:       Number(row['Buying Price'] || row['buying_price'] || 0),
          selling_price:      Number(row['Selling Price'] || row['selling_price'] || 0),
          stock_quantity:     Number(row['Stock'] || row['stock_quantity'] || 0),
          unit:               String(row['Unit'] || row['unit'] || 'Units').trim(),
          low_stock_threshold:Number(row['Low Stock'] || row['low_stock_threshold'] || 5),
          description:        String(row['Description'] || row['description'] || '').trim(),
        };

        if (!data.name) { errors.push(`Row skipped — no name`); continue; }

        if (data.sku_code) {
          const existing = await Product.findOne({ sku_code: data.sku_code });
          if (existing) {
            await Product.findByIdAndUpdate(existing._id, data);
            updated++;
          } else {
            await Product.create(data);
            created++;
          }
        } else {
          await Product.create(data);
          created++;
        }
      } catch (e) { errors.push(`Row error: ${e.message}`); }
    }

    res.json({ message: `Import done`, created, updated, errors: errors.slice(0, 10) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/products/export  — Download all products as Excel
const exportProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: { $ne: true } }).sort({ category: 1, name: 1 });

    const rows = products.map((p, i) => ({
      '#':             i + 1,
      'SKU':           p.sku_code,
      'Name':          p.name,
      'Category':      p.category,
      'Unit':          p.unit || 'Units',
      'Buying Price':  p.buying_price,
      'Selling Price': p.selling_price,
      'Profit/Unit':   p.selling_price - p.buying_price,
      'Margin %':      p.selling_price > 0 ? ((( p.selling_price - p.buying_price) / p.selling_price) * 100).toFixed(1) : 0,
      'Stock':         p.stock_quantity,
      'Low Stock Threshold': p.low_stock_threshold,
      'Description':   p.description,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 4 }, { wch: 18 }, { wch: 35 }, { wch: 14 }, { wch: 8 },
      { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
      { wch: 18 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Mudiyanse_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { importProducts, exportProducts, upload };
