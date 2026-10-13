import { describe, expect, it, vi } from 'vitest';

describe('processRegistry after shutdown has begun', () => {
  it('stops a process that only finished starting after quit was requested, instead of orphaning it', async () => {
    vi.resetModules();
    const { stopAllTrackedProcesses, trackProcess } = await import('./processRegistry.js');

    await stopAllTrackedProcesses(); // quit pressed mid-bootstrap

    const lateStop = vi.fn(async () => {});
    trackProcess(lateStop); // e.g. pg_ctl start -w resolving afterwards
    await vi.waitFor(() => expect(lateStop).toHaveBeenCalledTimes(1));
  });

  it('reports that shutdown has begun, so bootstrap can stop between steps', async () => {
    vi.resetModules();
    const registry = await import('./processRegistry.js');
    expect(registry.isShuttingDown()).toBe(false);
    await registry.stopAllTrackedProcesses();
    expect(registry.isShuttingDown()).toBe(true);
  });
});
