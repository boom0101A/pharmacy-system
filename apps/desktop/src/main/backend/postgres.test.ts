import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findFreePort,
  initdbArgs,
  isClusterInitialized,
  isInterruptedCluster,
  pgCtlStartArgs,
  pgCtlStopArgs,
} from './postgres.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgdata-'));
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('isClusterInitialized', () => {
  it('is false for an empty folder', () => {
    expect(isClusterInitialized(dataDir)).toBe(false);
  });

  it('is false for a folder that does not exist', () => {
    expect(isClusterInitialized(path.join(dataDir, 'missing'))).toBe(false);
  });

  it('is true once PG_VERSION exists, which is what initdb writes last', () => {
    fs.writeFileSync(path.join(dataDir, 'PG_VERSION'), '16\n');
    expect(isClusterInitialized(dataDir)).toBe(true);
  });
});

describe('initdbArgs', () => {
  it('creates a UTF8 cluster owned by the app role, with the password read from a file', () => {
    const args = initdbArgs({ dataDir: 'C:\\data', username: 'pharmacy', passwordFile: 'C:\\pw.txt' });

    expect(args).toContain('-D');
    expect(args).toContain('C:\\data');
    expect(args).toContain('--username=pharmacy');
    expect(args).toContain('--pwfile=C:\\pw.txt');
    expect(args).toContain('--encoding=UTF8');
  });

  it('requires a password instead of trusting any local connection', () => {
    // The bundled server listens on the machine anyway; "trust" would let any
    // local program read the pharmacy's data without credentials.
    const args = initdbArgs({ dataDir: 'C:\\data', username: 'pharmacy', passwordFile: 'C:\\pw.txt' });
    expect(args).toContain('--auth=scram-sha-256');
  });
});

describe('pgCtlStartArgs', () => {
  it('waits for the server to be ready rather than returning immediately', () => {
    const args = pgCtlStartArgs({ dataDir: 'C:\\data', port: 5433, logFile: 'C:\\pg.log' });
    expect(args).toContain('-w');
    expect(args[args.length - 1]).toBe('start');
  });

  it('binds only to localhost, so the database itself is never exposed to the network', () => {
    // The Express server is what other tills talk to; Postgres has no business
    // accepting connections from outside this machine.
    const args = pgCtlStartArgs({ dataDir: 'C:\\data', port: 5433, logFile: 'C:\\pg.log' });
    const options = args[args.indexOf('-o') + 1];
    expect(options).toContain('-p 5433');
    expect(options).toContain("-h 127.0.0.1");
  });
});

describe('pgCtlStopArgs', () => {
  it('shuts down cleanly so the next launch does not have to recover', () => {
    const args = pgCtlStopArgs('C:\\data');
    expect(args).toContain('stop');
    expect(args).toContain('-m');
    expect(args).toContain('fast');
  });
});

describe('isInterruptedCluster', () => {
  it('is false for a folder that does not exist — nothing to recover from', () => {
    expect(isInterruptedCluster(path.join(dataDir, 'missing'))).toBe(false);
  });

  it('is false for a genuinely empty folder — a normal first run, not a recovery', () => {
    expect(isInterruptedCluster(dataDir)).toBe(false);
  });

  it('is false once PG_VERSION exists — a real, finished cluster, never to be wiped', () => {
    fs.writeFileSync(path.join(dataDir, 'PG_VERSION'), '16\n');
    fs.writeFileSync(path.join(dataDir, 'some-real-data-file'), 'x');
    expect(isInterruptedCluster(dataDir)).toBe(false);
  });

  it('is true when the folder has content but PG_VERSION is missing — initdb started and never finished', () => {
    fs.writeFileSync(path.join(dataDir, 'base'), '');
    expect(isInterruptedCluster(dataDir)).toBe(true);
  });
});

describe('findFreePort', () => {
  it('returns the starting port when it is free', async () => {
    // A real, currently-unbound ephemeral port: ask the OS for one, then
    // release it immediately — 0 itself is a wildcard ("any port"), not a
    // real port number, so it can't be used as the thing under test here.
    const probe = net.createServer();
    const freePort = await new Promise<number>((resolve) => {
      probe.listen(0, '127.0.0.1', () => resolve((probe.address() as { port: number }).port));
    });
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    expect(await findFreePort(freePort)).toBe(freePort);
  });

  it('skips a port that is already bound and returns the next free one', async () => {
    const occupied = net.createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    const takenPort = (occupied.address() as { port: number }).port;

    try {
      const port = await findFreePort(takenPort, 5);
      expect(port).not.toBe(takenPort);
    } finally {
      occupied.close();
    }
  });

  it('gives up with a clear Arabic error after exhausting every attempt', async () => {
    const occupied = net.createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    const takenPort = (occupied.address() as { port: number }).port;

    try {
      await expect(findFreePort(takenPort, 1)).rejects.toThrow('منفذ');
    } finally {
      occupied.close();
    }
  });
});
