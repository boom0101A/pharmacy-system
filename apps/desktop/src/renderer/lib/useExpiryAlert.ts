import { useEffect } from 'react';
import { api } from './api.js';
import { useExpiryAlertState } from '../store/expiryAlert.js';
import { useStockVersion } from '../store/stockSync.js';

// Expiry dates move in days, not seconds — unlike the 7s connection ping,
// nothing is lost by checking this rarely. A freshly-received batch can
// still surface sooner than the timer via the stockVersion dependency below.
const EXPIRY_CHECK_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Mirrors useConnectionPing.ts's shape deliberately: fire once immediately,
 * then on an interval, tearing down on unmount. Kept free of useToast() —
 * this runs at the top of App.tsx, above where <ToastProvider> is even
 * rendered, so it can only ever update state; a separate component mounted
 * inside the provider is what turns a pending alert into an actual toast.
 */
export function useExpiryAlert(enabled: boolean) {
  const setLastAlertedCount = useExpiryAlertState((s) => s.setLastAlertedCount);
  const setPendingAlert = useExpiryAlertState((s) => s.setPendingAlert);
  const stockVersion = useStockVersion((s) => s.version);

  useEffect(() => {
    if (!enabled) return;

    // Guards a check that was started by an effect run which has since
    // unmounted (React StrictMode's dev-only mount/cleanup/remount, or
    // enabled/stockVersion flipping again before the previous check
    // resolved) from acting on a state the hook no longer owns.
    let cancelled = false;

    async function check() {
      try {
        const summary = await api.dashboard();
        if (cancelled) return;
        const count = summary.expiringSoonCount;
        if (count > 0 && count !== useExpiryAlertState.getState().lastAlertedCount) {
          setLastAlertedCount(count);
          setPendingAlert({ count });
        }
      } catch {
        // Best-effort — a failed check just tries again on the next interval.
      }
    }

    check();
    const timer = window.setInterval(check, EXPIRY_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // stockVersion: a newly-received batch can change what's expiring soon
    // sooner than the next scheduled poll — re-check right away when it moves.
  }, [enabled, stockVersion, setLastAlertedCount, setPendingAlert]);
}
