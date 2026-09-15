import { describe, expect, it, vi } from 'vitest';
import { runBootstrapSteps, type BootstrapSteps } from './bootstrap.js';

function steps(overrides: Partial<BootstrapSteps> = {}) {
  const order: string[] = [];
  const record = (name: string) => async () => {
    order.push(name);
  };
  return {
    order,
    steps: {
      ensureCluster: record('ensureCluster'),
      startPostgres: record('startPostgres'),
      stopPostgres: record('stopPostgres'),
      ensureDatabase: record('ensureDatabase'),
      migrate: record('migrate'),
      startServer: record('startServer'),
      stopServer: record('stopServer'),
      ...overrides,
    } as BootstrapSteps,
  };
}

describe('runBootstrapSteps', () => {
  it('creates the cluster before starting it, and the database before migrating it', async () => {
    const { order, steps: s } = steps();

    await runBootstrapSteps(s);

    expect(order).toEqual([
      'ensureCluster',
      'startPostgres',
      'ensureDatabase',
      'migrate',
      'startServer',
    ]);
  });

  it('stops the database when a later step fails, instead of leaving it running forever', async () => {
    const stopPostgres = vi.fn(async () => {});
    const { steps: s } = steps({
      migrate: async () => {
        throw new Error('migration blew up');
      },
      stopPostgres,
    });

    await expect(runBootstrapSteps(s)).rejects.toThrow('migration blew up');
    expect(stopPostgres).toHaveBeenCalled();
  });

  it('stops the server too when it was already spawned but never became ready, instead of leaving an orphan holding the port', async () => {
    const stopServer = vi.fn(async () => {});
    const { steps: s } = steps({
      startServer: async () => {
        // Simulates spawnServer succeeding but waitForServer timing out —
        // the process exists and must be killed, not just left running.
        throw new Error('الخادم لم يستجب خلال 30 ثانية');
      },
      stopServer,
    });

    await expect(runBootstrapSteps(s)).rejects.toThrow('لم يستجب');
    expect(stopServer).toHaveBeenCalledTimes(1);
  });

  it('stops the server before the database on any post-startup failure, since the server depends on it', async () => {
    const order: string[] = [];
    const { steps: s } = steps({
      migrate: async () => {
        throw new Error('boom');
      },
      stopServer: async () => {
        order.push('stopServer');
      },
      stopPostgres: async () => {
        order.push('stopPostgres');
      },
    });

    await expect(runBootstrapSteps(s)).rejects.toThrow('boom');
    expect(order).toEqual(['stopServer', 'stopPostgres']);
  });

  it('does not try to stop a database that never started', async () => {
    const stopPostgres = vi.fn(async () => {});
    const { steps: s } = steps({
      startPostgres: async () => {
        throw new Error('port in use');
      },
      stopPostgres,
    });

    await expect(runBootstrapSteps(s)).rejects.toThrow('port in use');
    expect(stopPostgres).not.toHaveBeenCalled();
  });

  it('reports progress so the window can say what is happening during a slow first run', async () => {
    const onProgress = vi.fn();
    const { steps: s } = steps();

    await runBootstrapSteps(s, onProgress);

    expect(onProgress).toHaveBeenCalled();
    expect(onProgress.mock.calls.flat()).toContain('database');
  });
});
