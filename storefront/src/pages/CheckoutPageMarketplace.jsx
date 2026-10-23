import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageCircle, ShoppingCart, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getItemSeller } from '../api/marketplaceAdapters';
import { formatLKR } from '../utils/formatLKR';
import { PLATFORM_INFO } from '../config/store';

// Milestone 5 Part A — marketplace mode has no real checkout yet
// (Milestone 6's scope). Instead of placing an order, this shows a clear
// "coming soon" message and a WhatsApp button prefilled with the full
// cart (what, how many, sold by whom) so a shopper can still actually
// order today, just not through an automated flow.
export default function CheckoutPageMarketplace() {
  const { t } = useTranslation(['checkout', 'common', 'marketplace']);
  const { cart, totalAmount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (cart.length === 0) navigate('/', { replace: true });
  }, [cart, navigate]);

  if (cart.length === 0) return null;

  const sellerGroups = [];
  for (const item of cart) {
    const seller = getItemSeller(item);
    let group = sellerGroups.find((g) => g.seller.slug === seller.slug || g.seller.id === seller.id);
    if (!group) { group = { seller, items: [] }; sellerGroups.push(group); }
    group.items.push(item);
  }

  const messageLines = [
    t('marketplace:checkoutComingSoon.whatsappIntro'),
    '',
    ...sellerGroups.flatMap((g) => [
      t('marketplace:checkoutComingSoon.soldBy', { seller: g.seller.name }),
      ...g.items.map((i) => `• ${i.name} x${i.qty} — ${formatLKR(i.selling_price * i.qty)}`),
      '',
    ]),
    t('marketplace:checkoutComingSoon.total', { total: formatLKR(totalAmount) }),
  ];
  const whatsappHref = `https://wa.me/${PLATFORM_INFO.supportWhatsapp}?text=${encodeURIComponent(messageLines.join('\n'))}`;

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px', maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={() => navigate('/cart')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}>
        <ArrowLeft size={16} /> {t('common:nav.backToStore')}
      </button>

      <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', textAlign: 'center', marginBottom: '24px' }}>
        <Clock size={40} color="var(--accent-primary)" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {t('marketplace:checkoutComingSoon.title')}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '24px' }}>
          {t('marketplace:checkoutComingSoon.body')}
        </p>
        <a
          href={whatsappHref} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            background: '#128037', color: 'white', textDecoration: 'none',
            padding: '14px 24px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
            boxShadow: '0 4px 14px rgba(37,211,102,0.28)',
          }}
        >
          <MessageCircle size={18} /> {t('marketplace:checkoutComingSoon.orderOnWhatsapp')}
        </a>
      </div>

      <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={16} /> {t('summary.heading')}
        </h2>
        {sellerGroups.map((group) => (
          <div key={group.seller.id || group.seller.slug} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              {t('marketplace:checkoutComingSoon.soldBy', { seller: group.seller.name })}
            </div>
            {group.items.map((item) => (
              <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.name} × {item.qty}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(item.selling_price * item.qty)}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '2px dashed var(--border)' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('summary.total')}</span>
          <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(totalAmount)}</span>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <Link to="/cart" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{t('marketplace:checkoutComingSoon.backToCart')}</Link>
      </p>
    </div>
  );
}
