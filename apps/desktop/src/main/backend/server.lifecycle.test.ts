import { spawn } from 'node:child_process';
import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { isPortAnswering, spawnServer, waitForServer } from './server.js';

describe('waitForServer with the spawned child', () => {
  it('fails fast with the exit code when the server process dies, instead of polling for 30 seconds', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(3)']);
    const start = Date.now();

    await expect(waitForServer(1, 30_000, child)).rejects.toThrow('3');
    expect(Date.now() - start).toBeLessThan(5_000);
  });
});

describe('isPortAnswering', () => {
  it('is true when something already answers /api/health on the port — e.g. a server orphaned by a crash', async () => {
    const orphan = http.createServer((_req, res) => res.end('{"ok":true}'));
    await new Promise<void>((resolve) => orphan.listen(0, '127.0.0.1', resolve));
    const port = (orphan.address() as { port: number }).port;
    try {
      expect(await isPortAnswering(port)).toBe(true);
    } finally {
      orphan.close();
    }
  });

  it('is false when nothing is listening', async () => {
    expect(await isPortAnswering(1)).toBe(false);
  });
});

describe('spawnServer onExit', () => {
  it('reports when the server process exits, so a crash after "ready" is no longer invisible', async () => {
    const onExit = vi.fn();
    spawnServer(process.execPath, '-e', {
      databaseUrl: 'x', jwtSecret: 'x', port: 1, uploadsDir: 'x', logsDir: 'x', backupsDir: 'x', publicDir: 'x',
    }, undefined, onExit);
    await vi.waitFor(() => expect(onExit).toHaveBeenCalled(), { timeout: 10_000 });
  });
});
