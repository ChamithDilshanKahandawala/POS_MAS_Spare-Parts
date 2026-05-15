import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ sale }, ref) => {
  if (!sale) return null;

  const fmtRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isCash = sale.payment_method === 'Cash';
  const isCOD = sale.payment_method === 'COD';
  
  const totalDiscount = (sale.total_discount || 0) + (sale.items?.reduce((acc, i) => acc + ((i.discount || 0) * (i.quantity || 1)), 0) || 0);

  return (
    <div ref={ref} className="receipt-container" style={{ padding: '0', margin: '0', background: '#fff', color: '#000' }}>
      <style type="text/css" media="print">
        {`
          @page { size: 80mm auto; margin: 0; }
          body { width: 72mm; margin: 0; padding: 2mm; font-family: 'Courier New', Consolas, monospace; font-size: 11px; line-height: 1.3; color: #000; }
          .receipt { width: 72mm; }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .double-height { font-size: 16px; font-weight: bold; }
          .separator-heavy { border-top: 1px solid #000; margin: 4px 0; }
          .separator-light { border-top: 1px dashed #000; margin: 4px 0; }
          .flex-between { display: flex; justify-content: space-between; }
        `}
      </style>

      <div className="receipt" style={{ fontFamily: "'Courier New', Consolas, monospace", fontSize: '11px', width: '72mm', padding: '2mm' }}>
        {/* HEADER */}
        <div className="center">
          <div className="double-height">Mudiyanse Auto Solutions</div>
          <div>No: 08, New Shopping Complex</div>
          <div>Mirigama</div>
          <div>Tel: 078 180 5711 / 078 153 8078</div>
        </div>

        {/* META */}
        <div className="separator-heavy"></div>
        <div className="left">
          <div>Invoice: {sale.invoice_number}</div>
          <div>Date:    {sale.createdAt}</div>
          <div>Cashier: {sale.cashier_name || 'Admin'}</div>
          {sale.sale_source !== 'shop' && (
            <div>Source:  {sale.sale_source === 'whatsapp' ? 'WhatsApp' : 'Online'}</div>
          )}
        </div>
        <div className="separator-light"></div>

        {/* ITEMS HEADER */}
        <div style={{ display: 'flex', fontWeight: 'bold' }}>
          <div style={{ width: '48%' }}>Item</div>
          <div style={{ width: '12%', textAlign: 'right' }}>Qty</div>
          <div style={{ width: '20%', textAlign: 'right' }}>Price</div>
          <div style={{ width: '20%', textAlign: 'right' }}>Total</div>
        </div>
        <div className="separator-light"></div>

        {/* LINE ITEMS */}
        {sale.items && sale.items.map((item, idx) => (
          <React.Fragment key={idx}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '48%', wordBreak: 'break-word' }}>{item.product_name}</div>
              <div style={{ width: '12%', textAlign: 'right' }}>{item.quantity}</div>
              <div style={{ width: '20%', textAlign: 'right' }}>{fmtRs(item.selling_price)}</div>
              <div style={{ width: '20%', textAlign: 'right' }}>{fmtRs(item.selling_price * item.quantity)}</div>
            </div>
            {item.discount > 0 && (
              <div style={{ textAlign: 'left', paddingLeft: '8px' }}>
                Disc: -{fmtRs(item.discount * item.quantity)}
              </div>
            )}
          </React.Fragment>
        ))}
        <div className="separator-light"></div>

        {/* TOTALS */}
        <div className="right">
          <div className="flex-between">
            <span>Subtotal:</span>
            <span>Rs. {fmtRs(sale.subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex-between">
              <span>Total Disc:</span>
              <span>-Rs. {fmtRs(totalDiscount)}</span>
            </div>
          )}
          {sale.shipping_cost_charged > 0 && (
            <div className="flex-between">
              <span>Shipping:</span>
              <span>Rs. {fmtRs(sale.shipping_cost_charged)}</span>
            </div>
          )}
          {sale.koko_charge > 0 && (
            <div className="flex-between">
              <span>KOKO Fee:</span>
              <span>Rs. {fmtRs(sale.koko_charge)}</span>
            </div>
          )}
          <div className="flex-between double-height" style={{ marginTop: '4px' }}>
            <span>TOTAL:</span>
            <span>Rs. {fmtRs(sale.total_amount + (sale.koko_charge || 0) + (sale.shipping_cost_charged || 0))}</span>
          </div>
        </div>
        <div className="separator-light"></div>

        {/* PAYMENT */}
        <div className="left">
          <div>Payment:  {sale.payment_method}</div>
          {isCash && sale.paid_amount > 0 && (
            <>
              <div>Paid:     Rs. {fmtRs(sale.paid_amount)}</div>
              <div>Change:   Rs. {fmtRs(sale.change)}</div>
            </>
          )}
          {isCOD && sale.cod_amount > 0 && (
            <div>COD Amt:  Rs. {fmtRs(sale.cod_amount)}</div>
          )}
        </div>

        {/* FOOTER */}
        <div className="separator-heavy"></div>
        <div className="center bold">
          Thank You.. Come Again..
        </div>
        <div className="separator-heavy"></div>
      </div>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';

export default ReceiptTemplate;
