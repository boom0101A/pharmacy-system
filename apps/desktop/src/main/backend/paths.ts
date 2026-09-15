import path from 'node:path';

export interface BackendEnvironment {
  isPackaged: boolean;
  /** Electron's `process.resourcesPath` — where extraResources land once installed. */
  resourcesPath: string;
  /** Electron's `app.getPath('userData')`. */
  userDataPath: string;
  /** Repository root, used only in development. */
  repoRoot: string;
}

export interface BackendPaths {
  pgBinDir: string;
  initdbExe: string;
  pgCtlExe: string;
  serverEntry: string;
  migrationsDir: string;
  /** Static assets the server serves (the phone capture page), staged beside the bundle. */
  publicDir: string;
  pgDataDir: string;
  uploadsDir: string;
  logsDir: string;
  backupsDir: string;
  secretsDir: string;
}

/**
 * Splits the backend's files in two: what the installer laid down (read-only,
 * next to the app) and what the running pharmacy accumulates (its database,
 * photos, backups and logs).
 *
 * The second group must never live inside the installation directory —
 * `Program Files` is read-only for a normal user, and an uninstall would take
 * the pharmacy's entire database with it.
 */
export function resolveBackendPaths(env: BackendEnvironment): BackendPaths {
  const pgBinDir = env.isPackaged
    ? path.join(env.resourcesPath, 'pgsql', 'bin')
    : path.join(env.repoRoot, 'apps', 'desktop', 'vendor', 'pgsql', 'bin');

  const serverEntry = env.isPackaged
    ? path.join(env.resourcesPath, 'server', 'server.mjs')
    : path.join(env.repoRoot, 'apps', 'server', 'dist', 'src', 'index.js');

  const migrationsDir = env.isPackaged
    ? path.join(env.resourcesPath, 'prisma', 'migrations')
    : path.join(env.repoRoot, 'apps', 'server', 'prisma', 'migrations');

  return {
    pgBinDir,
    initdbExe: path.join(pgBinDir, 'initdb.exe'),
    pgCtlExe: path.join(pgBinDir, 'pg_ctl.exe'),
    serverEntry,
    migrationsDir,
    publicDir: env.isPackaged
      ? path.join(env.resourcesPath, 'server', 'public')
      : path.join(env.repoRoot, 'apps', 'server', 'public'),
    pgDataDir: path.join(env.userDataPath, 'pgdata'),
    uploadsDir: path.join(env.userDataPath, 'uploads'),
    logsDir: path.join(env.userDataPath, 'logs'),
    backupsDir: path.join(env.userDataPath, 'backups'),
    secretsDir: env.userDataPath,
  };
}
