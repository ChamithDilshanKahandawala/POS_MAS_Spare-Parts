import { useTranslation } from 'react-i18next';
import AuthImage from '../AuthImage';
import { formatLKR } from '../../utils/formatLKR';
import { formatDateTime } from '../../utils/formatDateTime';
import { RETURN_STATUS_BADGE } from './returnConstants';

// Shared by the seller and admin return pages — status labels, the lines
// table, photos and the timeline. Strings live in common.json's `returns`
// block so both apps read the same wording.

export function ReturnStatusBadge({ status }) {
  const { t } = useTranslation('common');
  return <span className={`badge ${RETURN_STATUS_BADGE[status] || 'badge-blue'}`}>{t(`returns.status.${status}`)}</span>;
}

export function ReturnLines({ lines }) {
  const { t, i18n } = useTranslation('common');
  const total = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t('returns.lines.item')}</th>
          <th>{t('returns.lines.qty')}</th>
          <th>{t('returns.lines.unitPrice')}</th>
          <th>{t('returns.lines.total')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.sellerOrderItem}>
            <td>
              <div style={{ fontWeight: 600 }}>{line.title?.[i18n.language] || line.title?.en || line.sku}</div>
              {line.sku && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{line.sku}</div>}
            </td>
            <td>{line.qty}</td>
            <td>{formatLKR(line.unitPriceCents)}</td>
            <td style={{ fontWeight: 700 }}>{formatLKR(line.unitPriceCents * line.qty)}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>{t('returns.lines.refundValue')}</td>
          <td style={{ fontWeight: 800 }}>{formatLKR(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReturnPhotos({ count, fetchPhoto }) {
  const { t } = useTranslation('common');
  if (!count) return <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('returns.photos.none')}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
      {Array.from({ length: count }, (_, index) => (
        <AuthImage
          key={index}
          fetchBlob={fetchPhoto}
          index={index}
          alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-light)' }}
        />
      ))}
    </div>
  );
}

export function ReturnTimeline({ timeline }) {
  const { t } = useTranslation('common');
  const byLabel = {
    customer: t('returns.timeline.byCustomer'),
    seller: t('returns.timeline.bySeller'),
    platform: t('returns.timeline.byPlatform'),
    system: t('returns.timeline.bySystem'),
  };
  const groupOf = (role) => {
    if (role?.startsWith('seller_')) return 'seller';
    if (role?.startsWith('platform_')) return 'platform';
    return role;
  };
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {timeline.map((entry, index) => (
        <li key={index} style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{t(`returns.status.${entry.to}`)}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            {formatDateTime(entry.at)} · {byLabel[groupOf(entry.byRole)] || ''}
          </div>
          {entry.note && <div style={{ fontSize: '12.5px', marginTop: '4px' }}>{entry.note}</div>}
        </li>
      ))}
    </ol>
  );
}
