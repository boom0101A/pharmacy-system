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
