import { useEffect, useState, useCallback } from 'react';

// iOS Safari never fires beforeinstallprompt and has no programmatic
// install API — "Add to Home Screen" is a manual Share-sheet action only
// a human can take, so the best a page can do is tell them where to find
// it. `navigator.standalone` is iOS's own (non-standard) equivalent of the
// display-mode:standalone media query below.
function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Shared across the mobile-menu install item and the home-page install
// card — both need the same beforeinstallprompt event and the same
// "already installed, show nothing" check, and the event can only be
// prompt()'d once per capture.
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // A real beforeinstallprompt event can only be used once — discard it
    // either way (accepted or dismissed) rather than trying to re-prompt.
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: !isStandalone && !!deferredPrompt,
    isIOSHint: !isStandalone && !deferredPrompt && isIOSSafari(),
    isStandalone,
    promptInstall,
  };
}
