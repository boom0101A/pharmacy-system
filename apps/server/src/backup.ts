import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

/**
 * Every table, dumped verbatim (Prisma serializes Decimal/Date fields to
 * strings automatically through JSON.stringify) — restore.ts reloads these
 * same twelve arrays back in, in the reverse (parent-first) order.
 */
async function dumpTables() {
  const [
    users,
    categories,
    products,
    batches,
    suppliers,
    purchases,
    purchaseItems,
    sales,
    saleItems,
    returns,
    returnItems,
    batchWriteOffs,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany(),
    prisma.batch.findMany(),
    prisma.supplier.findMany(),
    prisma.purchase.findMany(),
    prisma.purchaseItem.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.return.findMany(),
    prisma.returnItem.findMany(),
    prisma.batchWriteOff.findMany(),
  ]);

  return {
    users,
    categories,
    products,
    batches,
    suppliers,
    purchases,
    purchaseItems,
    sales,
    saleItems,
    returns,
    returnItems,
    batchWriteOffs,
  };
}

/** Matches the naming scheme already used by every backup file this project has ever produced — colons aren't legal in a Windows filename. */
function backupFilename(date: Date): string {
  return `backup-${date.toISOString().replace(/:/g, '-')}.json`;
}

function defaultUploadsDir(): string {
  return config.uploadsDir;
}

/**
 * The JSON backup above only ever covered the 11 database tables — product
 * photos and the pharmacy logo live on disk under uploads/ and were never
 * copied anywhere, so a disk failure lost them permanently even with a
 * perfect DB restore. Takes the source dir as a parameter (defaulting to the
 * real uploads/ folder) so a test can point it at a throwaway directory
 * instead of the server's actual upload files.
 */
export async function backupUploads(uploadsSrc: string = defaultUploadsDir()): Promise<string | null> {
  try {
    await fs.access(uploadsSrc);
  } catch {
    return null; // Nothing uploaded yet — not an error, just nothing to do.
  }

  await fs.mkdir(config.backupDir, { recursive: true });
  const dest = path.join(config.backupDir, `uploads-${new Date().toISOString().replace(/:/g, '-')}`);
  await fs.cp(uploadsSrc, dest, { recursive: true });
  return dest;
}

async function pruneOldBackups() {
  const files = (await fs.readdir(config.backupDir))
    .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
    .sort(); // ISO timestamps in the filename sort chronologically as plain strings.

  const excess = files.length - config.backupRetention;
  if (excess <= 0) return;

  for (const file of files.slice(0, excess)) {
    await fs.unlink(path.join(config.backupDir, file)).catch(() => {});
  }
}

/**
 * Does the actual export and returns the path written. Left to throw on
 * failure — `createBackup` below is the server's own fire-and-forget wrapper;
 * `restore.ts` calls this directly instead, because a restore's own
 * pre-wipe safety snapshot failing silently is exactly the one case where
 * swallowing the error would be dangerous.
 */
export async function writeBackup(uploadsSrc?: string): Promise<string> {
  await fs.mkdir(config.backupDir, { recursive: true });

  const createdAt = new Date();
  const data = { createdAt: createdAt.toISOString(), tables: await dumpTables() };

  const file = path.join(config.backupDir, backupFilename(createdAt));
  await fs.writeFile(file, JSON.stringify(data));

  await backupUploads(uploadsSrc);
  await pruneOldBackups();
  return file;
}

/**
 * Exports the whole database to one JSON file. Runs once at boot and every
 * 24 hours (see index.ts) — deliberately swallows its own errors so a
 * disconnected external drive degrades to "no new backup today", not a dead
 * server.
 */
export async function createBackup(): Promise<void> {
  try {
    const file = await writeBackup();
    logger.info(`Backup written: ${file}`);
  } catch (err) {
    logger.error('Backup failed', err);
  }
}
