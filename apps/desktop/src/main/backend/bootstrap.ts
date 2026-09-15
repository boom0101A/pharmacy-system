import path from 'node:path';
import { applyPendingMigrations } from './migrate.js';
import { buildDatabaseUrl, ensureDatabase, migrationTarget, type ConnectionSettings } from './db.js';
import { ensureCluster, findFreePort, startPostgres, stopPostgres } from './postgres.js';
import { loadOrCreateSecrets } from './secrets.js';
import { spawnServer, waitForServer, type RunningServer } from './server.js';
import { stopAllTrackedProcesses, trackProcess } from './processRegistry.js';
import type { BackendPaths } from './paths.js';

/** What the bootstrap does, injectable so the ordering and failure handling can be tested without a real database. */
export interface BootstrapSteps {
  ensureCluster: () => Promise<void>;
  startPostgres: () => Promise<void>;
  stopPostgres: () => Promise<void>;
  ensureDatabase: () => Promise<void>;
  migrate: () => Promise<void>;
  startServer: () => Promise<void>;
  /** Stops the server if `startServer` got as far as spawning it — a spawn that succeeds but never answers /api/health (`waitForServer` timing out) must not leave the process running and the port held. */
  stopServer: () => Promise<void>;
}

export type BootstrapStage = 'database' | 'schema' | 'server';

/** What the window is told about the bundled backend, so a slow first launch can explain itself instead of looking like a failed connection. */
export type BackendStatus =
  | { status: 'disabled' }
  | { status: 'starting'; stage: BootstrapStage }
  | { status: 'ready' }
  | { status: 'failed'; message: string };

/**
 * Ordering matters: a cluster must exist before it can start, must be running
 * before its database can be created, and the schema must exist before the
 * server connects. If anything after startup fails, the database is stopped
 * again — otherwise a failed launch leaves a postgres process running with
 * nothing attached to it, and the next launch finds its port taken.
 */
export async function runBootstrapSteps(
  steps: BootstrapSteps,
  onProgress?: (stage: BootstrapStage) => void,
): Promise<void> {
  onProgress?.('database');
  await steps.ensureCluster();
  await steps.startPostgres();

  try {
    onProgress?.('schema');
    await steps.ensureDatabase();
    await steps.migrate();

    onProgress?.('server');
    await steps.startServer();
  } catch (err) {
    // Server first: it depends on the database, so stopping the database
    // first while the server is still up would just be a different half-dead
    // state instead of a clean one.
    await steps.stopServer();
    await steps.stopPostgres();
    throw err;
  }
}

export interface BackendHandle {
  serverUrl: string;
  shutdown: () => Promise<void>;
}

const DB_USER = 'pharmacy';
const DB_NAME = 'pharmacy';

/** Brings up the bundled database and server for a standalone installation. */
export async function startBundledBackend(
  paths: BackendPaths,
  electronBinary: string,
  options: { dbPort: number; serverPort: number },
  onProgress?: (stage: BootstrapStage) => void,
  /** Wired to the bootstrap log file — the server child's stdout/stderr is the one place an actual crash reason (a port conflict, a missing module) ever surfaces. */
  onLog?: (line: string) => void,
): Promise<BackendHandle> {
  const secrets = loadOrCreateSecrets(paths.secretsDir);
  // The bundled database's port is internal — nothing outside this app ever
  // needs to know it — so if some other program on the client's machine
  // already holds it, trying the next few ports costs nothing and avoids a
  // hard failure on a conflict that has nothing to do with this app.
  const dbPort = await findFreePort(options.dbPort);
  const conn: ConnectionSettings = {
    user: DB_USER,
    password: secrets.dbPassword,
    port: dbPort,
    database: DB_NAME,
  };
  const cluster = {
    initdbExe: paths.initdbExe,
    pgCtlExe: paths.pgCtlExe,
    dataDir: paths.pgDataDir,
    logFile: path.join(paths.logsDir, 'postgres.log'),
    port: dbPort,
    username: DB_USER,
    password: secrets.dbPassword,
  };

  let server: RunningServer | undefined;

  await runBootstrapSteps(
    {
      ensureCluster: () => ensureCluster(cluster),
      startPostgres: async () => {
        await startPostgres(cluster);
        // Tracked the moment it's actually running, not after the rest of
        // bootstrap succeeds — a quit that interrupts schema/server setup
        // must still be able to reach in and stop it from outside this
        // still-pending promise.
        trackProcess(() => stopPostgres(cluster));
      },
      stopPostgres: () => stopPostgres(cluster),
      ensureDatabase: () => ensureDatabase(conn),
      migrate: async () => {
        await applyPendingMigrations(paths.migrationsDir, migrationTarget(conn));
      },
      startServer: async () => {
        server = spawnServer(
          electronBinary,
          paths.serverEntry,
          {
            databaseUrl: buildDatabaseUrl(conn),
            jwtSecret: secrets.jwtSecret,
            port: options.serverPort,
            uploadsDir: paths.uploadsDir,
            logsDir: paths.logsDir,
            backupsDir: paths.backupsDir,
            publicDir: paths.publicDir,
          },
          onLog,
        );
        trackProcess(async () => server?.stop());
        await waitForServer(options.serverPort);
      },
      stopServer: async () => server?.stop(),
    },
    onProgress,
  );

  return {
    serverUrl: `http://127.0.0.1:${options.serverPort}`,
    // Both processes are already tracked above — stopping "everything
    // tracked" is exactly a normal shutdown, and re-running it later (say,
    // will-quit firing after this already ran) is a safe no-op.
    shutdown: () => stopAllTrackedProcesses(),
  };
}
