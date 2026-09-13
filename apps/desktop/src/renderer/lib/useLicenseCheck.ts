import { useEffect, useState } from 'react';

interface LicenseCheckState {
  /** null = still checking. */
  licensed: boolean | null;
  error: string | null;
}

/**
 * A rejected `getLicenseStatus()` IPC call (e.g. the machine-id registry read
 * failing) used to leave App.tsx's `licensed` state stuck at null forever —
 * an infinite boot spinner with no error shown anywhere. This always settles
 * `licensed` to a boolean, even on failure.
 */
export function useLicenseCheck(): LicenseCheckState {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.pharmacy
      .getLicenseStatus()
      .then((status) => setLicensed(status.valid))
      .catch((err: Error) => {
        setError(err.message || 'تعذّر التحقق من الترخيص');
        setLicensed(false);
      });
  }, []);

  return { licensed, error };
}
