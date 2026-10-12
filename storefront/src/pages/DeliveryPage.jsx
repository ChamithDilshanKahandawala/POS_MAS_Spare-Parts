import { useTranslation } from 'react-i18next';
import { Truck, CheckCircle2, XCircle, MessageCircle, Info } from 'lucide-react';
import { SHOP_INFO, DELIVERY_OPTIONS } from '../config/store';
import { formatAmount } from '../utils/formatLKR';
import useDocumentMeta from '../hooks/useDocumentMeta';

export default function DeliveryPage() {
  const { t } = useTranslation('delivery');
  useDocumentMeta(`${t('metaTitle')} | ${SHOP_INFO.name}`, t('metaDescription'));

  const [transexpress, slpost] = DELIVERY_OPTIONS;
  const whatsappHref = `https://wa.me/${SHOP_INFO.whatsapp}?text=${encodeURIComponent(t('whatsappCta'))}`;

  return (
    <div className="animate-fade" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="page-title">{t('heading')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{t('subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px', marginBottom: '20px' }}>
        {/* Transexpress */}
        <div className="glass-card" style={{ padding: '26px', borderRadius: '20px', border: '2px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Truck size={19} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('options.transexpress.name')}</h2>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('etaLabel', { days: transexpress.etaDays })}</div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700,
            color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '5px 12px', borderRadius: '999px', marginBottom: '16px',
          }}>
            <CheckCircle2 size={13} /> {t('codAvailable')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            <div>{t('options.transexpress.westernPricing', { price: formatAmount(transexpress.pricing.westernFirstKg) })}</div>
            <div>{t('options.transexpress.otherPricing', {
              min: formatAmount(transexpress.pricing.otherFirstKgMin),
              max: formatAmount(transexpress.pricing.otherFirstKgMax),
            })}</div>
            <div>{t('options.transexpress.additionalPricing', { price: formatAmount(transexpress.pricing.additionalPerKg) })}</div>
          </div>
        </div>

        {/* SL Speed Post */}
        <div className="glass-card" style={{ padding: '26px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Truck size={19} color="var(--text-muted)" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('options.slpost.name')}</h2>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('etaLabel', { days: slpost.etaDays })}</div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700,
            color: '#e74c3c', background: 'rgba(231,76,60,0.1)', padding: '5px 12px', borderRadius: '999px', marginBottom: '16px',
          }}>
            <XCircle size={13} /> {t('codNotAvailable')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            <div>{t('options.slpost.anywherePricing', { price: formatAmount(slpost.pricing.anywhereFirstKg) })}</div>
            <div>{t('options.slpost.additionalPricing', { price: formatAmount(slpost.pricing.additionalPerKg) })}</div>
          </div>

          <div style={{
            display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12.5px',
            color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '10px',
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            {t('options.slpost.contactNote')}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-secondary)',
        background: 'var(--accent-light)', padding: '16px 18px', borderRadius: '14px', marginBottom: '20px',
      }}>
        <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        {t('feeNote')}
      </div>

      <a
        href={whatsappHref} target="_blank" rel="noopener noreferrer"
        className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}
      >
        <MessageCircle size={16} /> {t('whatsappCta')}
      </a>
    </div>
  );
}
