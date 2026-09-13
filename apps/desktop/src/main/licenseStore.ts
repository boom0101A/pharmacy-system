import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getMachineId, verifyLicenseKey, type LicenseCheck } from './license.js';

interface StoredLicense {
  key: string | null;
}

/** Same lazy `app.getPath` call pattern as settings-store.ts, for the same reason: reading it eagerly at import time is fragile to module load order before `app` is ready. */
function filePath(): string {
  return path.join(app.getPath('userData'), 'license.json');
}

function readStored(): StoredLicense {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  } catch {
    return { key: null };
  }
}

/**
 * getMachineId() reads the Windows registry and can throw (permissions, AV
 * blocking reg.exe, a non-standard Windows build) — without this, that
 * exception used to escape both methods below uncaught, and the renderer's
 * `.then()` on the IPC call (App.tsx/Activation.tsx) had no `.catch()`
 * either, so a single bad registry read hung the app forever on the boot
 * spinner with no error shown anywhere.
 */
function safeGetMachineId(): { ok: true; id: string } | { ok: false; error: string } {
  try {
    return { ok: true, id: getMachineId() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const licenseStore = {
  /** Re-verified against the live machine ID every call, not just read from disk — a license moved onto a different machine has to fail the moment anyone asks, not just at the next reinstall. */
  getStatus(): LicenseCheck {
    const { key } = readStored();
    if (!key) return { valid: false, error: 'لم يتم تفعيل النظام بعد' };
    const machine = safeGetMachineId();
    if (!machine.ok) return { valid: false, error: machine.error };
    return verifyLicenseKey(key, machine.id);
  },

  activate(key: string): LicenseCheck {
    const machine = safeGetMachineId();
    if (!machine.ok) return { valid: false, error: machine.error };
    const result = verifyLicenseKey(key, machine.id);
    if (result.valid) {
      fs.mkdirSync(path.dirname(filePath()), { recursive: true });
      fs.writeFileSync(filePath(), JSON.stringify({ key } satisfies StoredLicense, null, 2));
    }
    return result;
  },
};
