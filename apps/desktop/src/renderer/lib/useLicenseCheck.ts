import { useEffect, useState } from 'react';

interface LicenseCheckState {
  /** null = still checking. */
  licensed: boolean | null;
  error: string | null;
  /** null = perpetual (or not licensed). */
  expiresAt: string | null;
}

/** Fired after Settings applies a renewal key, so the expiry banner follows at once. */
export const LICENSE_CHANGED_EVENT = 'pharmacy:license-changed';

const LICENSE_RECHECK_MS = 60_000;

/**
 * A rejected `getLicenseStatus()` IPC call (e.g. the machine-id registry read
 * failing) used to leave App.tsx's `licensed` state stuck at null forever —
 * an infinite boot spinner with no error shown anywhere. This always settles
 * `licensed` to a boolean, even on failure.
 */
export function useLicenseCheck(): LicenseCheckState {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    function check() {
      window.pharmacy
        .getLicenseStatus()
        .then((status) => {
          setLicensed(status.valid);
          setExpiresAt(status.valid ? status.payload.expiresAt : null);
        })
        .catch((err: Error) => {
          setError(err.message || 'تعذّر التحقق من الترخيص');
          setLicensed(false);
        });
    }
    check();
    // A trial key can run out while the till stays open all day. The check is
    // a local IPC call (no network), so once a minute — and whenever the
    // window regains focus — costs nothing.
    const timer = setInterval(check, LICENSE_RECHECK_MS);
    window.addEventListener(LICENSE_CHANGED_EVENT, check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener(LICENSE_CHANGED_EVENT, check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return { licensed, error, expiresAt };
}
