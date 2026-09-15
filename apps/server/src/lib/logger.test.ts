import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** logger.ts creates its directory at import time, so each case re-imports it fresh. */
async function loadLogger(logsDir: string) {
  process.env.LOGS_DIR = logsDir;
  vi.resetModules();
  const { logger } = await import('./logger.js');
  return logger;
}

const ORIGINAL_LOGS_DIR = process.env.LOGS_DIR;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_LOGS_DIR === undefined) delete process.env.LOGS_DIR;
  else process.env.LOGS_DIR = ORIGINAL_LOGS_DIR;
});

describe('logger', () => {
  it('writes into LOGS_DIR when one is set', async () => {
    const dir = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'logs-')), 'nested');
    const logger = await loadLogger(dir);

    logger.info('مرحباً');

    const written = await fs.promises.readFile(path.join(dir, 'server.log'), 'utf8');
    expect(JSON.parse(written.trim())).toMatchObject({ level: 'info', message: 'مرحباً' });
  });

  it('does not throw at import when the log directory cannot be created', async () => {
    // A file where a directory is expected — mkdir fails with ENOTDIR, the
    // real-world stand-in for an install under read-only Program Files.
    const blocker = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'logs-')), 'blocker');
    await fs.promises.writeFile(blocker, 'not a directory');

    await expect(loadLogger(path.join(blocker, 'logs'))).resolves.toBeDefined();
  });

  it('keeps logging to the console instead of crashing when the file cannot be written', async () => {
    const blocker = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'logs-')), 'blocker');
    await fs.promises.writeFile(blocker, 'not a directory');
    const logger = await loadLogger(path.join(blocker, 'logs'));

    expect(() => logger.error('الخادم تعطّل')).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  it('archives the old log to server.log.1 instead of deleting it, once it grows past the size limit', async () => {
    const dir = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'logs-')), 'nested');
    const logger = await loadLogger(dir);
    const logFile = path.join(dir, 'server.log');
    await fs.promises.writeFile(logFile, 'x'.repeat(5 * 1024 * 1024 + 1));

    logger.info('بعد التدوير');

    const archived = await fs.promises.readFile(path.join(dir, 'server.log.1'), 'utf8');
    expect(archived.length).toBeGreaterThan(5 * 1024 * 1024);
    const fresh = await fs.promises.readFile(logFile, 'utf8');
    expect(JSON.parse(fresh.trim())).toMatchObject({ message: 'بعد التدوير' });
  });

  it('replaces any existing server.log.1 rather than erroring, so rotation never piles up files', async () => {
    const dir = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'logs-')), 'nested');
    const logger = await loadLogger(dir);
    const logFile = path.join(dir, 'server.log');
    const archiveFile = path.join(dir, 'server.log.1');
    await fs.promises.writeFile(archiveFile, 'old archive');
    await fs.promises.writeFile(logFile, 'y'.repeat(5 * 1024 * 1024 + 1));

    logger.info('تدوير ثانٍ');

    const archived = await fs.promises.readFile(archiveFile, 'utf8');
    expect(archived).not.toContain('old archive');
    expect(archived.length).toBeGreaterThan(5 * 1024 * 1024);
  });
});
