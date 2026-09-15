import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read straight from the environment rather than through config.ts: config
// throws on an invalid JWT_SECRET, and the logger must stay usable while
// reporting exactly that kind of startup failure.
const logDir =
  process.env.LOGS_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs');
const logFile = path.join(logDir, 'server.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;

/**
 * A log file is a convenience, never a reason to refuse to run. An install
 * under a read-only folder used to kill the process right here, at import,
 * before anything could report why — now it degrades to console-only.
 */
let fileLoggingAvailable = true;
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  fileLoggingAvailable = false;
}

/** Keeps exactly one previous log around — deleting it outright would throw away the one record of what the server was doing right before whatever someone is now trying to diagnose. */
function rotateIfNeeded() {
  try {
    const { size } = fs.statSync(logFile);
    if (size >= MAX_LOG_BYTES) {
      fs.renameSync(logFile, `${logFile}.1`);
    }
  } catch {
    // No file yet — nothing to rotate.
  }
}

/** Error objects serialize to `{}` under plain JSON.stringify — message/stack/cause live on the prototype chain, not as own enumerable properties. */
function serializeMeta(meta: unknown): unknown {
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message, stack: meta.stack };
  }
  return meta;
}

function write(level: 'info' | 'error', message: string, meta?: unknown) {
  if (fileLoggingAvailable) {
    try {
      rotateIfNeeded();
      const line = JSON.stringify({
        time: new Date().toISOString(),
        level,
        message,
        ...(meta !== undefined ? { meta: serializeMeta(meta) } : {}),
      });
      fs.appendFileSync(logFile, line + '\n');
    } catch {
      // The disk filled up, the folder was removed mid-run, permissions
      // changed — none of which should take the till offline. Stop trying.
      fileLoggingAvailable = false;
    }
  }
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(message, meta ?? '');
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
