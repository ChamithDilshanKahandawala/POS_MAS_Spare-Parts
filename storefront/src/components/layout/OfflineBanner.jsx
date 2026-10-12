import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import useStaleProductData from '../../hooks/useStaleProductData';

// Shown app-wide (mounted once in StoreLayout) whenever either:
// - the browser reports no connectivity, or
// - the last /api/products response was actually served from the service
//   worker's cache (src/sw.js's NetworkFirst plugin only sets
//   X-From-SW-Cache when the live network request failed — see
//   staleDataSignal.js). The second case catches a request that failed for
//   a reason other than navigator.onLine going false (a slow connection
//   that times out, a dropped connection mid-request, etc.) — connectivity
//   and "am I looking at live data" aren't the same question.
export default function OfflineBanner() {
  const { t } = useTranslation('pwa');
  const isOnline = useOnlineStatus();
  const isStale = useStaleProductData();

  if (isOnline && !isStale) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: 'var(--accent-yellow)', color: '#1a1a2e',
      textAlign: 'center', padding: '8px 16px', fontSize: '12.5px', fontWeight: 700,
    }}>
      <WifiOff size={14} /> {t('offlineBanner')}
    </div>
  );
}
