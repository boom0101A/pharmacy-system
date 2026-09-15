import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { app } from './app.js';
import { config } from './config.js';
import { initStockSocket } from './sockets/stock.js';
import { logger } from './lib/logger.js';
import { createBackup } from './backup.js';
import { seedDefaultAccounts } from '../prisma/seed.js';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Only the bundled desktop launcher sets this: it creates the database from
 * nothing, so somebody has to put the first account in it. Left off elsewhere
 * so a hand-managed deployment keeps deciding for itself (the seed is
 * idempotent either way — it never touches an account that already exists).
 */
async function seedIfRequested() {
  if (process.env.SEED_ON_BOOT !== '1') return;
  try {
    await seedDefaultAccounts();
  } catch (err) {
    logger.error('Seeding default accounts failed', err);
  }
}

interface MinimalLogger {
  info: (message: string) => void;
  error: (message: string, meta?: unknown) => void;
}

/**
 * Without an `'error'` listener, a bind failure — most commonly another
 * program already holding the port — is an *uncaught exception*: the process
 * dies with no clean log line, and the desktop launcher's health poll just
 * times out after 30 seconds with no indication why. `exitCode` (not a hard
 * `process.exit()`) matches this codebase's existing convention (see
 * scripts/restore.ts's own catch block) — it lets Node drain naturally
 * instead of cutting off whatever the logger's own write is doing.
 */
export function listenOrExit(
  server: Server,
  port: number,
  log: MinimalLogger = logger,
  // Injectable so a test can observe "we're listening" without triggering a
  // real backup run (a genuine Prisma query + file write) as a side effect.
  onListening: () => void = () => {
    createBackup();
    setInterval(createBackup, BACKUP_INTERVAL_MS);
  },
): void {
  server.on('error', (err) => {
    log.error('فشل استماع الخادم', err);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    log.info(`Pharmacy server listening on http://0.0.0.0:${port}`);
    onListening();
  });
}

// Guards the real startup so importing this module (a test, for instance)
// never creates a live server or seeds the real database as a side effect.
// A plain identity check — not the stricter isDirectCliRun helper seed.ts and
// restore.ts use — because this file is *meant* to still recognize itself as
// the entry point after becoming server.mjs through bundling; the desktop
// launcher's server.mjs IS this file's own top-level code, not a dependency
// incidentally inlined into someone else's entry.
const isEntryPoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isEntryPoint) {
  const server = createServer(app);
  initStockSocket(server);

  // Seeding happens before the port opens, not after: the desktop launcher
  // treats a healthy /api/health as "ready to sign in", and a server that
  // answers before its first account exists would fail that very first login.
  await seedIfRequested();
  listenOrExit(server, config.port);
}
