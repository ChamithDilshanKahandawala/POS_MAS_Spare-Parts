import { useTranslation } from 'react-i18next';
import { storeLanguage, changeLanguagePreservingScroll, SUPPORTED_LANGUAGES } from '../../i18n';

// `variant="compact"` — desktop navbar segmented control (EN · සිං · தமிழ்).
// `variant="full"` — mobile menu, three full-width rows.
// Switching never reloads the page (i18next.changeLanguage is purely
// in-memory + a re-render) and touches nothing router/cart-related, so URL,
// scroll position and cart state are all naturally untouched by this.
export default function LanguageSwitcher({ variant = 'compact', onSelect }) {
  const { t, i18n } = useTranslation('common');

  const select = (lng) => {
    if (lng === i18n.language) { onSelect?.(); return; }
    changeLanguagePreservingScroll(lng);
    storeLanguage(lng);
    onSelect?.();
  };

  if (variant === 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {SUPPORTED_LANGUAGES.map((lng) => {
          const active = i18n.language === lng;
          return (
            <button
              key={lng}
              type="button"
              onClick={() => select(lng)}
              aria-pressed={active}
              aria-label={t('language.switchTo', { language: t(`language.name${lng.charAt(0).toUpperCase()}${lng.slice(1)}`) })}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: '10px',
                border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                background: active ? 'var(--accent-light)' : 'var(--bg-secondary)',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              }}
            >
              {t(`language.name${lng.charAt(0).toUpperCase()}${lng.slice(1)}`)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'flex', gap: '2px', padding: '3px',
        background: 'var(--bg-secondary)', borderRadius: '10px',
        border: '1px solid var(--border-light)',
      }}
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => select(lng)}
            aria-pressed={active}
            aria-label={t('language.switchTo', { language: t(`language.name${lng.charAt(0).toUpperCase()}${lng.slice(1)}`) })}
            style={{
              padding: '6px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
              background: active ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent',
              color: active ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {t(`language.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
