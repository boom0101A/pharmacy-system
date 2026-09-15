import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveBackendPaths } from './paths.js';

const PACKAGED = {
  isPackaged: true,
  resourcesPath: 'C:\\Program Files\\Pharmacy\\resources',
  userDataPath: 'C:\\Users\\sara\\AppData\\Roaming\\Pharmacy',
  repoRoot: 'F:\\work 2\\pharmacy-system',
};

const DEV = { ...PACKAGED, isPackaged: false };

/** Everything the running system writes to, as opposed to the read-only files the installer laid down. */
function writablePaths(paths: ReturnType<typeof resolveBackendPaths>) {
  return [paths.pgDataDir, paths.uploadsDir, paths.logsDir, paths.backupsDir, paths.secretsDir];
}

describe('resolveBackendPaths', () => {
  it('keeps every writable folder inside userData when installed, because Program Files is read-only', () => {
    const paths = resolveBackendPaths(PACKAGED);
    for (const dir of writablePaths(paths)) {
      expect(dir.startsWith(PACKAGED.userDataPath)).toBe(true);
    }
  });

  it('never puts a writable folder inside the installation directory', () => {
    const paths = resolveBackendPaths(PACKAGED);
    for (const dir of writablePaths(paths)) {
      expect(dir.startsWith(PACKAGED.resourcesPath)).toBe(false);
    }
  });

  it('reads the bundled engine, server and migrations out of resources when installed', () => {
    const paths = resolveBackendPaths(PACKAGED);
    expect(paths.pgBinDir).toBe(path.join(PACKAGED.resourcesPath, 'pgsql', 'bin'));
    // .mjs, not .js: the bundle keeps ESM so `import.meta.url` in the server's
    // own path helpers still resolves, and Electron-as-Node would otherwise
    // read a bare .js as CommonJS.
    expect(paths.serverEntry).toBe(path.join(PACKAGED.resourcesPath, 'server', 'server.mjs'));
    expect(paths.migrationsDir).toBe(path.join(PACKAGED.resourcesPath, 'prisma', 'migrations'));
    expect(paths.publicDir).toBe(path.join(PACKAGED.resourcesPath, 'server', 'public'));
  });

  it('reads them from the working copy in development instead', () => {
    const paths = resolveBackendPaths(DEV);
    expect(paths.pgBinDir).toBe(path.join(DEV.repoRoot, 'apps', 'desktop', 'vendor', 'pgsql', 'bin'));
    expect(paths.serverEntry).toBe(path.join(DEV.repoRoot, 'apps', 'server', 'dist', 'src', 'index.js'));
    expect(paths.migrationsDir).toBe(path.join(DEV.repoRoot, 'apps', 'server', 'prisma', 'migrations'));
  });

  it('still writes to userData in development, so a dev run cannot corrupt an installed pharmacy database', () => {
    const paths = resolveBackendPaths(DEV);
    for (const dir of writablePaths(paths)) {
      expect(dir.startsWith(DEV.userDataPath)).toBe(true);
    }
  });

  it('names the executables the bootstrap actually spawns', () => {
    const paths = resolveBackendPaths(PACKAGED);
    expect(paths.initdbExe).toBe(path.join(paths.pgBinDir, 'initdb.exe'));
    expect(paths.pgCtlExe).toBe(path.join(paths.pgBinDir, 'pg_ctl.exe'));
  });
});
