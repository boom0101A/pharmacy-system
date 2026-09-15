import { describe, expect, it, vi } from 'vitest';
import { spawnServer } from './server.js';

const SETTINGS = {
  databaseUrl: 'postgresql://x:y@127.0.0.1:5433/pharmacy?schema=public',
  jwtSecret: 'a'.repeat(64),
  port: 3000,
  uploadsDir: 'C:\\uploads',
  logsDir: 'C:\\logs',
  backupsDir: 'C:\\backups',
  publicDir: 'C:\\public',
};
import { serverEnv } from './server.js';

const INPUT = {
  databaseUrl: 'postgresql://pharmacy:pw@127.0.0.1:5433/pharmacy?schema=public',
  jwtSecret: 'a'.repeat(64),
  port: 3000,
  uploadsDir: 'C:\\Users\\sara\\AppData\\Roaming\\Pharmacy\\uploads',
  logsDir: 'C:\\Users\\sara\\AppData\\Roaming\\Pharmacy\\logs',
  backupsDir: 'C:\\Users\\sara\\AppData\\Roaming\\Pharmacy\\backups',
  publicDir: 'C:\\Program Files\\Pharmacy\\resources\\public',
};

describe('serverEnv', () => {
  it('passes everything config.ts requires, or the server exits at import', () => {
    const env = serverEnv(INPUT, {});
    expect(env.DATABASE_URL).toBe(INPUT.databaseUrl);
    expect(env.JWT_SECRET).toBe(INPUT.jwtSecret);
    expect(env.PORT).toBe('3000');
  });

  it('redirects every writable folder out of the installation directory', () => {
    const env = serverEnv(INPUT, {});
    expect(env.UPLOADS_DIR).toBe(INPUT.uploadsDir);
    expect(env.LOGS_DIR).toBe(INPUT.logsDir);
    expect(env.BACKUP_DIR).toBe(INPUT.backupsDir);
  });

  it('points the server at the bundled capture page, which bundling moved away from the server file', () => {
    expect(serverEnv(INPUT, {}).PUBLIC_DIR).toBe(INPUT.publicDir);
  });

  it('runs the Electron binary as plain Node, since an installed copy has no node.exe of its own', () => {
    expect(serverEnv(INPUT, {}).ELECTRON_RUN_AS_NODE).toBe('1');
  });

  it('asks the server to seed itself, or a freshly created database would have no account to log in with', () => {
    expect(serverEnv(INPUT, {}).SEED_ON_BOOT).toBe('1');
  });

  it('keeps the rest of the parent environment, so PATH and friends still work', () => {
    const env = serverEnv(INPUT, { PATH: 'C:\\Windows\\System32', SOMETHING: 'else' });
    expect(env.PATH).toBe('C:\\Windows\\System32');
    expect(env.SOMETHING).toBe('else');
  });

  it('never inherits a stray DATABASE_URL from the parent environment', () => {
    // A developer machine has one in its own environment; silently pointing a
    // client's till at it would be catastrophic.
    const env = serverEnv(INPUT, { DATABASE_URL: 'postgresql://someone@elsewhere/db' });
    expect(env.DATABASE_URL).toBe(INPUT.databaseUrl);
  });
});

describe('spawnServer', () => {
  it('reports a failed spawn through onLog instead of crashing the whole main process', async () => {
    // A real child_process 'error' event (not mocked): spawning a path that
    // cannot possibly exist is exactly what a packaging regression or an
    // antivirus quarantine looks like. Node emits 'error' on the
    // ChildProcess; with zero listeners that throws as an uncaught exception
    // in the *caller's* process, which for this app is the entire Electron
    // main process, not just the backend.
    const onLog = vi.fn();
    const missingBinary = 'C:\\this\\path\\definitely\\does\\not\\exist\\electron.exe';

    const running = spawnServer(missingBinary, 'server.mjs', SETTINGS, onLog);

    await new Promise((resolve) => running.process.on('error', resolve));
    // The listener above and the one spawnServer itself must have installed
    // both fire for the same event — this only proves ours ran too.
    expect(onLog).toHaveBeenCalled();
    expect(onLog.mock.calls.some(([line]) => typeof line === 'string' && line.length > 0)).toBe(true);
  });

  it('does not throw synchronously even when onLog is not provided', () => {
    const missingBinary = 'C:\\this\\path\\definitely\\does\\not\\exist\\electron.exe';
    expect(() => spawnServer(missingBinary, 'server.mjs', SETTINGS)).not.toThrow();
  });
});
