import { useEffect, useState } from 'react';

// navigator.onLine is only a connectivity *hint* (can be wrong on a
// captive portal, for instance), but it's exactly what's needed here: a
// fast, synchronous signal to show the offline banner / block a submit
// before even attempting a network request, rather than waiting for one to
// time out. The 'online'/'offline' window events keep it live afterward.
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
