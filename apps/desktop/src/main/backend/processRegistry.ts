export type Cleanup = () => Promise<void>;

const active: Cleanup[] = [];
let shuttingDown = false;

/**
 * Registers a running process's own shutdown so it can be stopped later
 * regardless of whether the bootstrap sequence that started it ever finishes,
 * fails, or is interrupted from outside (a quit mid-first-run-setup, for
 * instance — long before `startBundledBackend`'s promise ever settles).
 *
 * Once shutdown has begun, a process that only now finished starting (say
 * `pg_ctl start -w` resolving after the quit) is stopped straight away —
 * nobody would ever drain the registry again, and it would outlive the app
 * holding its port and data directory against the next launch.
 */
export function trackProcess(cleanup: Cleanup): void {
  if (shuttingDown) {
    void cleanup().catch(() => {});
    return;
  }
  active.push(cleanup);
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/**
 * Stops every tracked process, most-recently-started first — the server
 * before the database it depends on — and forgets them. Safe to call more
 * than once, safe to call with nothing tracked, and one process failing to
 * stop never prevents the others from being tried.
 */
export async function stopAllTrackedProcesses(): Promise<void> {
  shuttingDown = true;
  const cleanups = active.splice(0, active.length).reverse();
  for (const cleanup of cleanups) {
    await cleanup().catch(() => {});
  }
}
