import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl, ensureDatabase } from './db.js';

describe('buildDatabaseUrl', () => {
  it('points Prisma at the bundled cluster on its own port', () => {
    const url = buildDatabaseUrl({
      user: 'pharmacy',
      password: 'secret',
      port: 5433,
      database: 'pharmacy',
    });
    expect(url).toBe('postgresql://pharmacy:secret@127.0.0.1:5433/pharmacy?schema=public');
  });

  it('escapes a password containing URL-significant characters', () => {
    // Generated passwords are hex today, but a literal @ or / would silently
    // truncate the host and send Prisma somewhere else entirely.
    const url = buildDatabaseUrl({
      user: 'pharmacy',
      password: 'p@ss/word:1',
      port: 5433,
      database: 'pharmacy',
    });
    expect(url).toContain(encodeURIComponent('p@ss/word:1'));
    expect(url).toContain('@127.0.0.1:5433/pharmacy');
  });
});

describe('ensureDatabase connection timeout', () => {
  it('gives up instead of hanging forever when the port accepts a connection but never responds', async () => {
    // Simulates a firewall silently dropping packets, or an overloaded
    // database that never completes the handshake — pg's own default
    // (connectionTimeoutMillis: 0) is "wait forever", which would otherwise
    // leave the whole bootstrap sequence stuck with no way to tell a genuine
    // hang apart from a merely slow one.
    const stuckServer = net.createServer(() => {
      // Accept the TCP connection, then say nothing, ever.
    });
    await new Promise<void>((resolve) => stuckServer.listen(0, '127.0.0.1', resolve));
    const port = (stuckServer.address() as { port: number }).port;

    const start = Date.now();
    try {
      await expect(
        ensureDatabase({ user: 'pharmacy', password: 'x', port, database: 'pharmacy' }),
      ).rejects.toThrow();
      expect(Date.now() - start).toBeLessThan(15_000);
    } finally {
      stuckServer.close();
    }
  }, 20_000);
});

describe('migrationChecksum', async () => {
  const { createHash } = await import('node:crypto');
  const { migrationChecksum } = await import('./db.js');

  it('is the SHA-256 hex Prisma itself records, so `prisma migrate status` does not flag every migration as modified', () => {
    const sql = 'CREATE TABLE x (id int);\n';
    expect(migrationChecksum(sql)).toBe(createHash('sha256').update(sql).digest('hex'));
  });
});
