/**
 * Whether a server address means "this machine" or "another computer".
 *
 * Pointing a till at another computer is also how it is told to stop running
 * its own bundled database: two servers on one network both writing their own
 * data is worse than either alone.
 */
export function serverModeForUrl(url: string): 'local' | 'remote' {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
      ? 'local'
      : 'remote';
  } catch {
    // A malformed address is about to fail anyway; disabling the bundled
    // server on top of that would turn a typo into an unusable install.
    return 'local';
  }
}

/**
 * The address the screen should switch to, or null to leave it alone. On the
 * machine that runs the bundled server, an address typed by hand (say
 * localhost:4000) used to override it permanently — the server was up, but
 * the app kept trying the wrong port and showed "تعذّر الاتصال بالخادم"
 * forever. An address on another computer is a deliberate choice and is kept.
 */
export function correctedLocalServerUrl(
  storedUrl: string,
  backend: BackendStatus,
): string | null {
  if (backend.status !== 'ready') return null;
  if (serverModeForUrl(storedUrl) !== 'local') return null;
  return storedUrl.replace(/\/$/, '') === backend.serverUrl ? null : backend.serverUrl;
}
