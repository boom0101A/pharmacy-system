import { useEffect, useState } from 'react';

const POLL_MS = 1000;
/** While disabled the backend may still start later — right after licence activation on a first launch. */
const DISABLED_POLL_MS = 3000;

/**
 * Polls the main process while the bundled backend comes up. Stops as soon as
 * it settles — there is nothing to watch once the server is running, and the
 * connection banner already covers losing it later.
 */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({ status: 'disabled' });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await window.pharmacy.getBackendStatus();
        if (cancelled) return;
        setStatus(next);
        if (next.status === 'starting') {
          window.setTimeout(poll, POLL_MS);
        } else if (next.status === 'disabled') {
          window.setTimeout(poll, DISABLED_POLL_MS);
        }
      } catch {
        // The channel only exists in the desktop shell; a browser-based dev
        // session simply has no bundled backend to report on.
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
