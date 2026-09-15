import { spawn, type ChildProcess } from 'node:child_process';

export interface ServerSettings {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  uploadsDir: string;
  logsDir: string;
  backupsDir: string;
  publicDir: string;
}

/**
 * The child process's environment. Every value config.ts demands is set
 * explicitly and last, so nothing inherited from the parent — a developer's
 * own DATABASE_URL, for instance — can redirect a pharmacy's till.
 */
export function serverEnv(
  settings: ServerSettings,
  parentEnv: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return {
    ...parentEnv,
    // An installed copy ships no node.exe; Electron's own binary runs plain
    // JavaScript when this is set.
    ELECTRON_RUN_AS_NODE: '1',
    DATABASE_URL: settings.databaseUrl,
    JWT_SECRET: settings.jwtSecret,
    PORT: String(settings.port),
    UPLOADS_DIR: settings.uploadsDir,
    LOGS_DIR: settings.logsDir,
    BACKUP_DIR: settings.backupsDir,
    PUBLIC_DIR: settings.publicDir,
    // The bundled database is created empty; without this the very first
    // launch would have no account anyone could sign in with.
    SEED_ON_BOOT: '1',
  };
}

export interface RunningServer {
  process: ChildProcess;
  stop: () => void;
}

export function spawnServer(
  electronBinary: string,
  serverEntry: string,
  settings: ServerSettings,
  onLog?: (line: string) => void,
): RunningServer {
  const child = spawn(electronBinary, [serverEntry], {
    env: serverEnv(settings, process.env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => onLog?.(chunk.toString().trimEnd()));
  child.stderr?.on('data', (chunk: Buffer) => onLog?.(chunk.toString().trimEnd()));
  // Without this, spawn() failing entirely (a packaging regression pointing
  // at a path that doesn't exist, antivirus quarantine, EACCES) emits
  // 'error' with zero listeners — Node throws that as an uncaught exception
  // in the *caller's* process, which for this app is the whole Electron main
  // process, not just the backend.
  child.on('error', (err) => onLog?.(`فشل تشغيل الخادم: ${err.message}`));

  return {
    process: child,
    stop: () => {
      if (!child.killed) child.kill();
    },
  };
}

/** Polls /api/health until the server answers, so the window never loads against a server that is not listening yet. */
export async function waitForServer(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`الخادم لم يستجب خلال ${Math.round(timeoutMs / 1000)} ثانية`);
}
