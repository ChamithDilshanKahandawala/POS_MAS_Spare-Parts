import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { hasSeenLanguageBanner, dismissLanguageBanner, storeLanguage, changeLanguagePreservingScroll } from '../../i18n';

// First-visit-only banner above the navbar. Shown only in English (if
// someone already switched away, they've already "seen" it — see
// hasSeenLanguageBanner) — one tap on either half switches straight to
// that language; the × just dismisses without switching. Either action is
// remembered so it never reappears.
export default function LanguageBanner() {
  const { i18n } = useTranslation();
  const [dismissed, setDismissed] = useState(() => hasSeenLanguageBanner());

  if (dismissed || i18n.language !== 'en') return null;

  const switchTo = (lng) => {
    changeLanguagePreservingScroll(lng);
    storeLanguage(lng);
    setDismissed(true);
  };

  const dismiss = () => {
    dismissLanguageBanner();
    setDismissed(true);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
      background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)',
      padding: '8px 16px', fontSize: '13px', flexWrap: 'wrap', textAlign: 'center',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>
        <button
          type="button" onClick={() => switchTo('si')}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
        >
          සිංහලෙන් බලන්න
        </button>
        {' · '}
        <button
          type="button" onClick={() => switchTo('ta')}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
        >
          தமிழில் பார்க்க
        </button>
      </span>
      <button
        type="button" onClick={dismiss} aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', padding: '2px',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
