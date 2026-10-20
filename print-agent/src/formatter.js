// formatter.js — Converts sale JSON into a structured print plan
// Shop info is hardcoded here. Do not put it in the payload.

const SHOP = {
  name:    'MUDIYANSE AUTO SOLUTIONS',
  line1:   'No: 08, New Shopping Complex',
  line2:   'Mirigama',
  phones:  '078 180 5711 / 078 153 8078',
  footer:  'Thank You.. Come Again..',
};

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
 * Main export: convert raw sale data into a structured receipt object
 * that printer.js will consume.
 */
export function formatReceipt(sale) {
  // Normalise item shape — handle both frontend-mapped and raw MongoDB shapes
  const items = (sale.items || []).map(i => {
    const discount = i.discount || 0;
    const basePrice = i.unitPrice ?? i.selling_price;
    // A markup (negative discount) should show as the increased price itself,
    // not the old base price — a real discount keeps showing the old price
    // with a separate "Disc:" line.
    const unitPrice = discount < 0 ? basePrice - discount : basePrice;
    return {
      name:      i.name      || i.product_name || 'Item',
      qty:       i.qty       ?? i.quantity,
      unitPrice,
      lineTotal: i.lineTotal ?? i.line_total,
      discount,
    };
  });

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
      fmtAmount,
    },
  };
}

export { SHOP, fmtAmount };
