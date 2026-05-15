// formatter.js — Converts sale JSON into a structured print plan
// Shop info is hardcoded here. Do not put it in the payload.

const SHOP = {
  name:    'MUDIYANSE AUTO SOLUTIONS',
  line1:   'No: 08, New Shopping Complex',
  line2:   'Mirigama',
  phones:  '078 180 5711 / 078 153 8078',
  footer:  'Thank You.. Come Again..',
};

const LINE_WIDTH = 48; // characters at standard font on 80mm

/**
 * Pad a string on the left to a given width.
 */
function padLeft(str, width) {
  str = String(str);
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

/**
 * Pad a string on the right to a given width.
 */
function padRight(str, width) {
  str = String(str);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Truncate a string to maxLen, appending '...' if truncated.
 */
function truncate(str, maxLen) {
  str = String(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Format a number as Sri Lankan Rupees: "1,234.00"
 * (the "Rs." prefix is added in the formatter where needed)
 */
function fmtAmount(value) {
  return Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format ISO datetime → "2026-05-15 14:32"
 */
function fmtDateTime(isoString) {
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo' }); // DD/MM/YYYY
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo'
    });
    return `${date} ${time}`;
  } catch {
    return isoString;
  }
}

/**
 * Build one item row. Layout (48 chars):
 *   Name (max 24 chars)    Qty   Price    Total
 *   Wheel Cap Toyota Aqu     2  1500.00  3000.00
 * Column widths: name=24, qty=4, price=9, total=9 → total = 48 (with 2 gaps)
 */
function buildItemRow(item) {
  const name    = padRight(truncate(item.name || item.product_name, 22), 22);
  const qty     = padLeft(String(item.qty ?? item.quantity), 3);
  const price   = padLeft(fmtAmount(item.unitPrice ?? item.selling_price), 9);
  const total   = padLeft(fmtAmount(item.lineTotal ?? item.line_total), 9);
  return `${name} ${qty} ${price} ${total}`;
}

/**
 * Main export: convert raw sale data into a structured receipt object
 * that printer.js will consume.
 */
export function formatReceipt(sale) {
  // Normalise item shape — handle both frontend-mapped and raw MongoDB shapes
  const items = (sale.items || []).map(i => ({
    name:      i.name      || i.product_name || 'Item',
    qty:       i.qty       ?? i.quantity,
    unitPrice: i.unitPrice ?? i.selling_price,
    lineTotal: i.lineTotal ?? i.line_total,
    discount:  i.discount  || 0,
  }));

  const subtotal  = Number(sale.subtotal  || 0);
  const itemDiscountSum = items.reduce((sum, i) => sum + (Number(i.discount) * (Number(i.qty) || 1)), 0);
  const billDiscount = Number(sale.discount ?? sale.total_discount ?? 0);
  const discount  = billDiscount + itemDiscountSum;
  const total     = Number(sale.total     ?? sale.total_amount   ?? 0);
  const amountPaid = Number(sale.amountPaid ?? sale.paid_amount  ?? 0);
  const change    = Number(sale.change    || 0);
  const kokoCharge = Number(sale.koko_charge || 0);
  const shipping   = Number(sale.shipping_cost_charged || 0);

  const paymentMethod = sale.paymentMethod || sale.payment_method || 'Cash';
  const saleSource    = sale.saleSource    || sale.sale_source    || 'shop';

  return {
    shop: SHOP,
    meta: {
      invoiceNumber: sale.id || sale.invoice_number || '-',
      dateTime:      fmtDateTime(sale.dateTime || sale.createdAt),
      cashierName:   sale.cashierName || sale.cashier_name || '-',
      paymentMethod,
      saleSource,
    },
    items,
    totals: {
      subtotal,
      discount,
      kokoCharge,
      shipping,
      total,
      amountPaid,
      change,
    },
    helpers: {
      LINE_WIDTH,
      padLeft,
      padRight,
      truncate,
      fmtAmount,
      buildItemRow,
    },
  };
}

export { SHOP, LINE_WIDTH, padLeft, padRight, truncate, fmtAmount, buildItemRow };
