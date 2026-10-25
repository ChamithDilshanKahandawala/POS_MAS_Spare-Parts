const crypto = require('crypto');
const SellerOrder = require('../models/SellerOrder');
const CodRemittanceRow = require('../models/CodRemittanceRow');
const CourierColumnMapping = require('../models/CourierColumnMapping');
const { parseCsv } = require('./csv');

// Rupees-and-cents text ("1,234.50", "1234.5", "1234") -> integer cents.
// Courier exports are never going to hand us pre-converted cents, so
// this is the one place that does the ×100 + round, same "never trust a
// float past this boundary" discipline as everywhere else in this
// project that touches money.
function parseAmountToCents(raw) {
  const cleaned = String(raw ?? '').replace(/,/g, '').trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function parseDateCell(raw) {
  const d = new Date(String(raw ?? '').trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

// Milestone 7 Part B.2 — parses an uploaded remittance file against its
// courier's saved column mapping, matches each row to a delivered COD
// seller order by tracking number, and persists every genuinely-new row
// (duplicates of an already-seen trackingNumber+reference pair are
// reported but never written twice — see CodRemittanceRow's own
// comment). Returns a summary the upload endpoint hands back to the
// admin console.
async function processRemittanceUpload({ courierName, fileText, uploadedBy }) {
  const mapping = await CourierColumnMapping.findOne({ courierName }).lean();
  if (!mapping) {
    const err = new Error(`No column mapping saved for courier "${courierName}" yet — set one up first.`);
    err.statusCode = 400;
    throw err;
  }

  const table = parseCsv(fileText);
  if (table.length < 2) {
    const err = new Error('File has no data rows');
    err.statusCode = 400;
    throw err;
  }
  const header = table[0].map((h) => h.trim());
  const columnDefs = [
    ['trackingNumber', mapping.trackingNumberColumn],
    ['codAmount', mapping.codAmountColumn],
    ['remittanceDate', mapping.remittanceDateColumn],
    ['reference', mapping.referenceColumn],
  ];
  const colIndex = {};
  for (const [key, columnName] of columnDefs) {
    const idx = header.indexOf(columnName);
    if (idx === -1) {
      const err = new Error(`Column "${columnName}" not found in the uploaded file's header row`);
      err.statusCode = 400;
      throw err;
    }
    colIndex[key] = idx;
  }

  const uploadBatchId = crypto.randomUUID();
  const summary = { matched: 0, short: 0, over: 0, unknownTracking: 0, duplicate: 0, errors: 0, total: table.length - 1 };
  const results = [];

  for (let i = 1; i < table.length; i += 1) {
    const cells = table[i];
    if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
    const trackingNumber = (cells[colIndex.trackingNumber] || '').trim();
    const codAmountCents = parseAmountToCents(cells[colIndex.codAmount]);
    const remittanceDate = parseDateCell(cells[colIndex.remittanceDate]);
    const reference = (cells[colIndex.reference] || '').trim();
    const rawRow = Object.fromEntries(header.map((h, idx) => [h, cells[idx]]));

    if (!trackingNumber || codAmountCents === null || !remittanceDate || !reference) {
      summary.errors += 1;
      results.push({ row: i + 1, matchStatus: 'error', rawRow });
      continue;
    }

    // Part B.4 — already seen this exact tracking+reference pair before
    // (this upload or an earlier one) — report it, write nothing.
     
    const existing = await CodRemittanceRow.findOne({ trackingNumber, reference }).select('_id').lean();
    if (existing) {
      summary.duplicate += 1;
      results.push({ row: i + 1, matchStatus: 'duplicate', trackingNumber, reference });
      continue;
    }

     
    const order = await SellerOrder.findOne({ trackingNumber, status: 'delivered', paymentMethod: 'cod' });
    let matchStatus;
    if (!order) {
      matchStatus = 'unknown_tracking';
    } else if (codAmountCents === order.codAmountCents) {
      matchStatus = 'matched';
    } else if (codAmountCents < order.codAmountCents) {
      matchStatus = 'short';
    } else {
      matchStatus = 'over';
    }

     
    const row = await CodRemittanceRow.create({
      courierName, trackingNumber, codAmountCents, remittanceDate, reference,
      matchStatus, sellerOrder: order?._id || null, rawRow, uploadBatchId, uploadedBy,
    });

    // Only an EXACT match actually marks the order's COD as reconciled —
    // a 'short'/'over' row still needs a human to resolve the
    // discrepancy before the sale entry is allowed to become payable
    // (services/ledgerMaturity.js's sweep checks codMatched, not just
    // "a row exists").
    if (matchStatus === 'matched') {
       
      await SellerOrder.updateOne(
        { _id: order._id },
        { $set: { codMatched: true, codMatchedAt: new Date(), codRemittanceRow: row._id } }
      );
    }

    summary[matchStatus === 'unknown_tracking' ? 'unknownTracking' : matchStatus] += 1;
    results.push({ row: i + 1, matchStatus, trackingNumber, reference, codAmountCents, orderCodAmountCents: order?.codAmountCents ?? null });
  }

  return { uploadBatchId, summary, results };
}

// Admin Finance (Part E) — delivered COD orders with no matching
// remittance row after the configured grace period.
async function listCodNotReceived(afterDays) {
  const cutoff = new Date(Date.now() - afterDays * 24 * 60 * 60 * 1000);
  return SellerOrder.find({
    status: 'delivered', paymentMethod: 'cod', codMatched: false, deliveredAt: { $lte: cutoff },
  }).select('orderNumber seller deliveredAt codAmountCents trackingNumber courier').populate('seller', 'name displayName').sort({ deliveredAt: 1 }).lean();
}

module.exports = { processRemittanceUpload, listCodNotReceived, parseAmountToCents, parseDateCell };
