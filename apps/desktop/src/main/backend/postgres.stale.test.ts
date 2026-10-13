import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureCluster, findFreePort, startPostgres, stopPostgres } from './postgres.js';

const binDir = path.resolve(__dirname, '..', '..', '..', 'vendor', 'pgsql', 'bin');
const hasBinaries = fs.existsSync(path.join(binDir, 'pg_ctl.exe'));

describe.skipIf(!hasBinaries)('startPostgres with a cluster already running', () => {
  it('recovers from a postmaster left running by a crashed or force-killed previous launch', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-stale-'));
    const opts = {
      initdbExe: path.join(binDir, 'initdb.exe'),
      pgCtlExe: path.join(binDir, 'pg_ctl.exe'),
      dataDir: path.join(root, 'pgdata'),
      logFile: path.join(root, 'logs', 'postgres.log'),
      port: await findFreePort(55600),
      username: 'pharmacy',
      password: 'secret',
    };
    try {
      await ensureCluster(opts);
      await startPostgres(opts); // the "previous launch", never stopped

      const nextPort = await findFreePort(opts.port + 1);
      await expect(startPostgres({ ...opts, port: nextPort })).resolves.toBeUndefined();
    } finally {
      await stopPostgres(opts);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
