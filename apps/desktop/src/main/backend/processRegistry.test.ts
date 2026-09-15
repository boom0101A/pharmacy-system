import { describe, expect, it, vi } from 'vitest';
import { stopAllTrackedProcesses, trackProcess } from './processRegistry.js';

describe('processRegistry', () => {
  it('stops every tracked process', async () => {
    const stopA = vi.fn(async () => {});
    const stopB = vi.fn(async () => {});
    trackProcess(stopA);
    trackProcess(stopB);

    await stopAllTrackedProcesses();

    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });

  it('stops the most-recently-tracked process first, since later processes depend on earlier ones', async () => {
    const order: string[] = [];
    trackProcess(async () => {
      order.push('database');
    });
    trackProcess(async () => {
      order.push('server');
    });

    await stopAllTrackedProcesses();

    expect(order).toEqual(['server', 'database']);
  });

  it('is safe to call twice — the second call finds nothing left to stop', async () => {
    const stop = vi.fn(async () => {});
    trackProcess(stop);

    await stopAllTrackedProcesses();
    await stopAllTrackedProcesses();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('is safe to call with nothing tracked at all', async () => {
    await expect(stopAllTrackedProcesses()).resolves.toBeUndefined();
  });

  it('never lets one process failing to stop prevent the others from being stopped', async () => {
    const failing = vi.fn(async () => {
      throw new Error('already dead');
    });
    const succeeding = vi.fn(async () => {});
    trackProcess(failing);
    trackProcess(succeeding);

    await expect(stopAllTrackedProcesses()).resolves.toBeUndefined();
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
