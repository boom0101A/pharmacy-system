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
    stockAdjustments,
  ] = await prisma.$transaction(
    [
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
      prisma.stockAdjustment.findMany(),
    ],
    // One snapshot of the whole database. Twelve independent reads while the
    // tills keep selling could capture a sale's lines without the sale (or
    // stock that disagrees with it) — a backup the restore then refuses.
    { isolationLevel: 'RepeatableRead' },
  );

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
    stockAdjustments,
  };
}

/** Matches the naming scheme already used by every backup file this project has ever produced — colons aren't legal in a Windows filename. */
export function backupFilename(date: Date): string {
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

/** Keeps the newest `backupRetention` of each kind — the JSON dumps and the uploads/ copies (which otherwise grew by a full image set every run until the disk filled). */
async function pruneOldBackups() {
  const entries = await fs.readdir(config.backupDir);
  // ISO timestamps in the names sort chronologically as plain strings.
  const groups = [
    entries.filter((f) => f.startsWith('backup-') && f.endsWith('.json')).sort(),
    entries.filter((f) => f.startsWith('uploads-')).sort(),
  ];

  for (const group of groups) {
    const excess = group.length - config.backupRetention;
    for (const name of group.slice(0, Math.max(0, excess))) {
      await fs.rm(path.join(config.backupDir, name), { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** Reads the timestamp back out of `backupFilename`'s naming scheme. */
function backupDateFromName(name: string): Date | null {
  const match = name.match(/^backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d{3})Z\.json$/);
  if (!match) return null;
  const [, day, h, m, s, ms] = match;
  return new Date(`${day}T${h}:${m}:${s}.${ms}Z`);
}

/**
 * True when a backup younger than a day already exists. The server backs up at
 * every boot; on a till restarted several times a day that used to push the
 * fixed retention window down to a few days of real history.
 */
export async function hasRecentBackup(now: Date = new Date()): Promise<boolean> {
  const entries = await fs.readdir(config.backupDir).catch(() => [] as string[]);
  return entries.some((name) => {
    const date = backupDateFromName(name);
    return date !== null && now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
  });
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
  // Temp file + rename: a crash mid-write must never leave a truncated file
  // that counts toward retention and pushes a good backup out.
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);

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
