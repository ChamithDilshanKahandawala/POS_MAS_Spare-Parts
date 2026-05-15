import { forwardRef } from 'react';

const Receipt = forwardRef(({ sale }, ref) => {
  if (!sale) return null;

  const fmtRs = (v) =>
    `Rs. ${Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div ref={ref} className="receipt-paper">
      <div className="receipt-title">MAS SPARE PARTS</div>
      <div className="receipt-sub">No 123, Main Road, City</div>
      <div className="receipt-sub">Tel: 077 123 4567</div>
      
      <hr className="receipt-divider" />
      
      <div className="receipt-row">
        <span>Inv: {sale.invoice_number}</span>
        <span>{formatDate(sale.created_at)}</span>
      </div>
      <div className="receipt-row">
        <span>Customer: {sale.customer_name || 'Walk-in'}</span>
        <span>{sale.payment_method}</span>
      </div>
      {sale.sale_source === 'whatsapp' && (
        <div className="receipt-row">
          <span>Source: WhatsApp</span>
          <span>Trk: {sale.tracking_number || '-'}</span>
        </div>
      )}

      <hr className="receipt-divider" />

      {sale.items?.map((item, idx) => {
        const lineTotal = (item.selling_price - (item.discount || 0)) * item.quantity;
        return (
          <div key={idx} style={{ marginBottom: '6px' }}>
            <div className="receipt-item-name">{item.product_id?.name || 'Item'}</div>
            <div className="receipt-row">
              <span>{item.quantity} x {fmtRs(item.selling_price)}</span>
              <span>{fmtRs(lineTotal)}</span>
            </div>
            {item.discount > 0 && (
              <div className="receipt-row" style={{ fontSize: '9px', color: '#666', marginTop: '-2px' }}>
                <span>Discount:</span>
                <span>-{fmtRs(item.discount * item.quantity)}</span>
              </div>
            )}
          </div>
        );
      })}

      <hr className="receipt-divider" />

      <div className="receipt-row">
        <span>Subtotal</span>
        <span>{fmtRs(sale.subtotal)}</span>
      </div>
      {sale.total_discount > 0 && (
        <div className="receipt-row">
          <span>Bill Discount</span>
          <span>-{fmtRs(sale.total_discount)}</span>
        </div>
      )}
      {sale.shipping_cost_charged > 0 && (
        <div className="receipt-row">
          <span>Shipping</span>
          <span>{fmtRs(sale.shipping_cost_charged)}</span>
        </div>
      )}
      {sale.koko_charge > 0 && (
        <div className="receipt-row">
          <span>KOKO Charge</span>
          <span>{fmtRs(sale.koko_charge)}</span>
        </div>
      )}

      <hr className="receipt-divider" />

      <div className="receipt-row total">
        <span>TOTAL</span>
        <span>{fmtRs(sale.total_amount + (sale.koko_charge || 0) + (sale.shipping_cost_charged || 0))}</span>
      </div>

      {sale.sale_source === 'whatsapp' && sale.cod_amount > 0 && (
        <div className="receipt-row" style={{ fontWeight: 'bold', marginTop: '4px' }}>
          <span>COD TO COLLECT:</span>
          <span>{fmtRs(sale.cod_amount)}</span>
        </div>
      )}

      <hr className="receipt-divider" />

      <div className="receipt-thank">THANK YOU FOR YOUR BUSINESS!</div>
      <div className="receipt-center">Please keep this receipt for warranty.</div>
      <div className="receipt-center" style={{ marginTop: '8px' }}>---</div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
