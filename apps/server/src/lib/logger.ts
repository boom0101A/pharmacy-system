import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const logDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs');
const logFile = path.join(logDir, 'server.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;

fs.mkdirSync(logDir, { recursive: true });

function rotateIfNeeded() {
  try {
    const { size } = fs.statSync(logFile);
    if (size >= MAX_LOG_BYTES) {
      fs.rmSync(logFile, { force: true });
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
  rotateIfNeeded();
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: serializeMeta(meta) } : {}),
  });
  fs.appendFileSync(logFile, line + '\n');
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(message, meta ?? '');
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
