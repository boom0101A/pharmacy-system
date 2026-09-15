import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Runs a tool with its stdio detached.
 *
 * `pg_ctl start` launches the postmaster and exits, but the postmaster
 * inherits its pipes and keeps them open for as long as the database runs —
 * so anything that waits for stdio to close (execFile does) never returns,
 * and startup hangs forever with a perfectly healthy database running.
 * Diagnostics are not lost: pg_ctl writes them to its -l log file.
 */
function runDetachedStdio(exe: string, args: string[], context: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${context} فشل (رمز الخروج ${code})`));
    });
  });
}

/** initdb writes PG_VERSION only after the cluster is fully built, so its presence means "safe to start", not "started creating". */
export function isClusterInitialized(dataDir: string): boolean {
  return fs.existsSync(path.join(dataDir, 'PG_VERSION'));
}

/**
 * True when a previous `initdb` was started but never finished — the app
 * quit (or crashed) partway through first-run setup. The directory exists
 * and has some content, but never got far enough to write PG_VERSION (which
 * `initdb` always writes last). Safe to discard entirely and start over: no
 * real database work could ever have happened without it existing.
 */
export function isInterruptedCluster(dataDir: string): boolean {
  if (!fs.existsSync(dataDir)) return false;
  if (isClusterInitialized(dataDir)) return false;
  return fs.readdirSync(dataDir).length > 0;
}

/** Resolves once nothing is listening on this port on the loopback interface. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

/**
 * The bundled database's port is internal — nothing outside this app ever
 * needs to know it — so if something else on the client's machine already
 * holds it, trying the next few ports is free of the tradeoffs that would
 * apply to the LAN-facing server port (which other tills are told to type in
 * by hand and must therefore stay fixed).
 */
export async function findFreePort(startPort: number, maxAttempts = 5): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`تعذّر إيجاد منفذ متاح بدءاً من ${startPort}`);
}

export function initdbArgs(opts: { dataDir: string; username: string; passwordFile: string }): string[] {
  return [
    '-D',
    opts.dataDir,
    `--username=${opts.username}`,
    `--pwfile=${opts.passwordFile}`,
    '--encoding=UTF8',
    // Anything else would let any local process open the pharmacy's database
    // without a password.
    '--auth=scram-sha-256',
  ];
}

export function pgCtlStartArgs(opts: { dataDir: string; port: number; logFile: string }): string[] {
  return [
    '-D',
    opts.dataDir,
    '-l',
    opts.logFile,
    '-o',
    `-p ${opts.port} -h 127.0.0.1`,
    // Without -w this returns before the server can answer, and the first
    // query races the startup.
    '-w',
    'start',
  ];
}

export function pgCtlStopArgs(dataDir: string): string[] {
  return ['-D', dataDir, '-m', 'fast', 'stop'];
}

export interface ClusterOptions {
  initdbExe: string;
  pgCtlExe: string;
  dataDir: string;
  logFile: string;
  port: number;
  username: string;
  password: string;
}

/** Creates the cluster on first launch. The password reaches initdb through a file that is deleted immediately — a command line is visible to every other process on the machine. */
export async function ensureCluster(opts: ClusterOptions): Promise<void> {
  if (isClusterInitialized(opts.dataDir)) return;
  if (isInterruptedCluster(opts.dataDir)) {
    fs.rmSync(opts.dataDir, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(opts.dataDir), { recursive: true });
  const passwordFile = path.join(path.dirname(opts.dataDir), 'initdb-password.tmp');
  fs.writeFileSync(passwordFile, opts.password, { mode: 0o600 });
  try {
    // Bounded so a stuck initdb (an unresponsive network-mounted userData
    // folder, aggressive real-time antivirus scanning) fails loudly instead
    // of leaving the "جارٍ التهيئة…" splash spinning forever with no way to
    // tell it apart from a merely slow one.
    await run(opts.initdbExe, initdbArgs({ dataDir: opts.dataDir, username: opts.username, passwordFile }), {
      timeout: 60_000,
    });
  } finally {
    fs.rmSync(passwordFile, { force: true });
  }
}

export async function startPostgres(opts: ClusterOptions): Promise<void> {
  fs.mkdirSync(path.dirname(opts.logFile), { recursive: true });
  await runDetachedStdio(
    opts.pgCtlExe,
    pgCtlStartArgs({ dataDir: opts.dataDir, port: opts.port, logFile: opts.logFile }),
    `تشغيل قاعدة البيانات (راجع ${opts.logFile})`,
  );
}

export async function stopPostgres(opts: Pick<ClusterOptions, 'pgCtlExe' | 'dataDir'>): Promise<void> {
  try {
    await runDetachedStdio(opts.pgCtlExe, pgCtlStopArgs(opts.dataDir), 'إيقاف قاعدة البيانات');
  } catch {
    // Already stopped, or never started — quitting must not hang on this.
  }
}
