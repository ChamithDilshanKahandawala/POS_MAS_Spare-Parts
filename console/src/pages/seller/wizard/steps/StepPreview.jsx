import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import MediaImage from '../../../../components/MediaImage';

const LANGS = ['en', 'si', 'ta'];

function fieldToStep(field) {
  if (field.startsWith('attributes.') || field === 'fitment') return 3;
  if (field === 'images') return 4;
  if (['priceCents', 'wasPriceCents', 'stock', 'weightGrams', 'lowStockAlert'].includes(field)) return 5;
  if (field === 'warranty') return 6;
  return 2;
}

// Renders the simple **bold** / "- bullet" convention from RichTextArea
// as real markup — exactly what a customer would eventually see, not the
// raw markers.
function renderDescription(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const bullet = line.trim().startsWith('- ');
    const content = bullet ? line.trim().slice(2) : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (
      part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
    ));
    return bullet ? <li key={i}>{parts}</li> : <p key={i} style={{ margin: '0 0 6px' }}>{parts}</p>;
  });
}

export default function StepPreview({ listing, problems, onRunCheck, onGoToStep }) {
  const { t } = useTranslation(['seller', 'common']);
  const [lang, setLang] = useState('en');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    onRunCheck().finally(() => setChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = (listing.priceCents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const wasPrice = listing.wasPriceCents ? (listing.wasPriceCents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) : null;

  return (
    <div className="sidebar-detail-layout">
      <div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {LANGS.map((l) => (
            <button key={l} className={lang === l ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {/* A phone-width card — literally 360px, matching the spec's own mobile breakpoint. */}
        <div className="glass-card" style={{ width: '340px', maxWidth: '100%', padding: '14px', margin: '0 auto' }}>
          <div style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px', background: 'var(--bg-secondary)' }}>
            {listing.images?.[0] && <MediaImage mediaId={listing.images[0]._id} size="medium" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{listing.title?.[lang] || listing.title?.en || t('wizard.preview.noTitle')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary-text)' }}>Rs {price}</span>
            {wasPrice && <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>Rs {wasPrice}</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {renderDescription(listing.description?.[lang] || listing.description?.en)}
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t('wizard.preview.checklistTitle')}</h4>
        {!checked ? (
          <div>{t('common:loading')}</div>
        ) : problems.length === 0 ? (
          <div className="glass-card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-green)' }}>
            <CheckCircle size={16} /> {t('wizard.preview.allGood')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {problems.map((p, i) => (
              <button
                key={i} type="button" onClick={() => onGoToStep(fieldToStep(p.field))}
                className="glass-card"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%' }}
              >
                <AlertTriangle size={14} color="var(--accent-yellow)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '13px' }}>{p.problem}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
