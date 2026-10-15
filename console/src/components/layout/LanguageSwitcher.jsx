import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../i18n';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Languages size={14} color="var(--text-muted)" />
      <select
        className="select-field"
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{ fontSize: '12px', width: 'auto', padding: '6px 8px' }}
        aria-label={t('admin:topbar.language')}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>{t(`common:languages.${lng}`)}</option>
        ))}
      </select>
    </div>
  );
}
