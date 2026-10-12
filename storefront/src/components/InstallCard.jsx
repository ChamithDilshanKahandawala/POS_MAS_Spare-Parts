import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';
import useInstallPrompt from '../hooks/useInstallPrompt';

const DISMISSED_KEY = 'storefrontInstallCardDismissed';

function getDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// One-time dismissible card on the home page. Android/desktop Chrome gets
// a real Install button (the captured beforeinstallprompt); iOS Safari —
// which has no install API at all — gets the manual Share-sheet
// instructions instead. Shows nothing once installed (handled by
// useInstallPrompt's canInstall/isIOSHint already excluding standalone).
export default function InstallCard() {
  const { t } = useTranslation('pwa');
  const { canInstall, isIOSHint, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(getDismissed);

  if (dismissed || (!canInstall && !isIOSHint)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* fine if it doesn't persist */ }
    setDismissed(true);
  };

  const handleInstall = async () => {
    await promptInstall();
    dismiss();
  };

  return (
    <div className="glass-card" style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px',
      borderRadius: '16px', marginBottom: '24px', border: '1px solid var(--accent-light)',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Download size={19} color="var(--accent-primary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
          {t('installCardTitle')}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          {isIOSHint ? t('iosInstallHint') : t('installCardBody')}
        </div>
      </div>
      {canInstall && (
        <button onClick={handleInstall} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', flexShrink: 0 }}>
          {t('installCardInstall')}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label={isIOSHint ? t('iosInstallDismiss') : t('installCardDismiss')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', padding: '4px', flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
