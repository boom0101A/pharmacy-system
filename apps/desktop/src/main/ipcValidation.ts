import type { Settings } from './settings-store.js';

/**
 * node-thermal-printer treats any interface string that isn't a known printer
 * scheme as a *file path* and writes the receipt bytes to it — so an unchecked
 * printerPath turned "print a barcode label" into "write these bytes to any
 * file on this machine" (a Startup-folder script, for instance).
 */
export function isAllowedPrinterPath(value: string): boolean {
  const v = value.trim();
  return (
    /^(COM|LPT)\d{1,3}$/i.test(v) ||
    /^\\\\\.\\[^\\/]+$/.test(v) || // \\.\COM4
    /^\\\\[^\\/.][^\\/]*\\[^\\/]+$/.test(v) || // \\host\SharedPrinter
    /^tcp:\/\/[\w.-]+(:\d{1,5})?$/i.test(v) ||
    /^printer:.+$/i.test(v) ||
    /^\/dev\/[\w/.-]+$/.test(v)
  );
}

const NULLABLE_STRING_KEYS = [
  'printerPath',
  'pharmacyName',
  'pharmacyAddress',
  'pharmacyPhone',
  'logoCachedVersion',
] as const;

/** The renderer can only set known settings, each with its own type. */
export function sanitizeSettingsPatch(patch: Record<string, unknown>): Partial<Settings> {
  const clean: Partial<Settings> = {};
  for (const key of NULLABLE_STRING_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value !== null && typeof value !== 'string') continue;
    if (key === 'printerPath' && typeof value === 'string' && value.trim() && !isAllowedPrinterPath(value)) continue;
    clean[key] = value;
  }
  if (patch.serverMode === 'local' || patch.serverMode === 'remote') clean.serverMode = patch.serverMode;
  return clean;
}

/** Password resets are minted from the server secret, so they may only ever be sent to this machine's own server. */
export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
