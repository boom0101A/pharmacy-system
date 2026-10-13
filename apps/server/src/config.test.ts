import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * config.ts reads process.env at import time, so every case here re-imports it
 * with a fresh module registry rather than mutating an already-built object.
 */
async function loadConfig() {
  vi.resetModules();
  const { config } = await import('./config.js');
  return config;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.UPLOADS_DIR;
  delete process.env.LOGS_DIR;
  delete process.env.PUBLIC_DIR;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('config directories', () => {
  it('uses UPLOADS_DIR when set, so an installed app can write outside Program Files', async () => {
    process.env.UPLOADS_DIR = 'C:\\ProgramData\\pharmacy\\uploads';
    const config = await loadConfig();
    expect(config.uploadsDir).toBe('C:\\ProgramData\\pharmacy\\uploads');
  });

  it('uses LOGS_DIR when set', async () => {
    process.env.LOGS_DIR = 'C:\\ProgramData\\pharmacy\\logs';
    const config = await loadConfig();
    expect(config.logsDir).toBe('C:\\ProgramData\\pharmacy\\logs');
  });

  it('uses PUBLIC_DIR when set, because bundling moves the server file and the phone capture page would 404', async () => {
    process.env.PUBLIC_DIR = 'C:\\Program Files\\Pharmacy\\resources\\public';
    const config = await loadConfig();
    expect(config.publicDir).toBe('C:\\Program Files\\Pharmacy\\resources\\public');
  });

  it('falls back to the in-repo paths when the env vars are absent, so development is unchanged', async () => {
    const config = await loadConfig();
    expect(config.uploadsDir).toMatch(/uploads$/);
    expect(config.logsDir).toMatch(/logs$/);
    // Absolute, never cwd-relative: a child process spawned with a different
    // cwd must still land on the same folders.
    expect(config.uploadsDir).toMatch(/^([A-Za-z]:|\/)/);
    expect(config.logsDir).toMatch(/^([A-Za-z]:|\/)/);
  });
});

describe('config backupDir default', () => {
  it('is an absolute folder next to the server, not relative to whatever the working directory happens to be', async () => {
    delete process.env.BACKUP_DIR;
    const config = await loadConfig();
    expect(config.backupDir.startsWith('.')).toBe(false);
    expect(config.backupDir.endsWith('backups')).toBe(true);
  });
});
