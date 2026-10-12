import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// registerType is 'prompt' (not 'autoUpdate') in vite.config.js precisely
// so this is the only thing that ever calls updateServiceWorker() — a
// visitor mid-checkout should never have the page reload out from under
// them. The toast stays up (no auto-dismiss) until they click Refresh.
export default function UpdatePrompt() {
  const { t } = useTranslation('pwa');
  const toastIdRef = useRef(null);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(url, registration) {
      // Check for a new version on every page/route load, not just once —
      // matches "when a new version is deployed" for a visitor who keeps
      // the tab open across releases.
      registration?.update();
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toastIdRef.current = toast(
      (toastInstance) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {t('updateAvailable')}
          <button
            onClick={() => { toast.dismiss(toastInstance.id); updateServiceWorker(true); }}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={13} /> {t('refresh')}
          </button>
        </span>
      ),
      { duration: Infinity, id: 'sw-update-available' }
    );
    return () => { if (toastIdRef.current) toast.dismiss(toastIdRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRefresh]);

  return null;
}
