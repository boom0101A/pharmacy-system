export type Cleanup = () => Promise<void>;

const active: Cleanup[] = [];

/**
 * Registers a running process's own shutdown so it can be stopped later
 * regardless of whether the bootstrap sequence that started it ever finishes,
 * fails, or is interrupted from outside (a quit mid-first-run-setup, for
 * instance — long before `startBundledBackend`'s promise ever settles).
 */
export function trackProcess(cleanup: Cleanup): void {
  active.push(cleanup);
}

/**
 * Stops every tracked process, most-recently-started first — the server
 * before the database it depends on — and forgets them. Safe to call more
 * than once, safe to call with nothing tracked, and one process failing to
 * stop never prevents the others from being tried.
 */
export async function stopAllTrackedProcesses(): Promise<void> {
  const cleanups = active.splice(0, active.length).reverse();
  for (const cleanup of cleanups) {
    await cleanup().catch(() => {});
  }
}
