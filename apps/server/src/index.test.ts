import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenOrExit } from './index.js';

describe('listenOrExit', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('reports a clean, logged failure instead of an uncaught exception when the port is already taken', async () => {
    // Both bound to 0.0.0.0 — listenOrExit itself always binds 0.0.0.0
    // internally, and binding the occupier to 127.0.0.1 only would not
    // reliably conflict with that on every platform.
    const occupier = createServer();
    await new Promise<void>((resolve) => occupier.listen(0, '0.0.0.0', resolve));
    const port = (occupier.address() as { port: number }).port;

    const contender = createServer();
    const logger = { info: vi.fn(), error: vi.fn() };

    await new Promise<void>((resolve) => {
      contender.on('error', () => resolve()); // our own listener, just to await the event
      listenOrExit(contender, port, logger, () => {});
    });

    expect(logger.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    occupier.close();
    contender.close();
  });

  it('logs the listening address and does not touch exitCode on success', async () => {
    const server = createServer();
    const logger = { info: vi.fn(), error: vi.fn() };
    const onListening = vi.fn();

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
      listenOrExit(server, 0, logger, onListening);
    });

    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(originalExitCode);

    server.close();
  });

  it('runs the given callback (starting backups, in production) only once listening actually succeeds', async () => {
    const server = createServer();
    const onListening = vi.fn();

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
      listenOrExit(server, 0, { info: vi.fn(), error: vi.fn() }, onListening);
    });

    expect(onListening).toHaveBeenCalledTimes(1);
    server.close();
  });
});
