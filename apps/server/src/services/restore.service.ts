import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { writeBackup } from '../backup.js';
import { AppError } from '../middleware/errors.js';

const rows = z.array(z.record(z.unknown()));

const backupSchema = z.object({
  createdAt: z.string(),
  tables: z.object({
    users: rows,
    categories: rows,
    products: rows,
    batches: rows,
    suppliers: rows,
    purchases: rows,
    purchaseItems: rows,
    sales: rows,
    saleItems: rows,
    returns: rows,
    returnItems: rows,
    // Backups written before write-offs existed have no such table.
    batchWriteOffs: rows.default([]),
    // Nor before quantity corrections did.
    stockAdjustments: rows.default([]),
  }),
});

export type BackupPayload = z.infer<typeof backupSchema>;

/** Wipes every table and reloads the backup's rows, ids included, in one transaction. */
export async function applyRestore(payload: BackupPayload): Promise<void> {
  const t = payload.tables;
  await prisma.$transaction(async (tx) => {
    // Children before parents, so no foreign key ever points at a row that's
    // about to disappear.
    await tx.stockAdjustment.deleteMany();
    await tx.returnItem.deleteMany();
    await tx.return.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.sale.deleteMany();
    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();
    await tx.batchWriteOff.deleteMany();
    await tx.batch.deleteMany();
    await tx.product.deleteMany();
    await tx.supplier.deleteMany();
    await tx.category.deleteMany();
    await tx.user.deleteMany();

    // Parents before children, in exact reverse — and every row keeps its
    // original id, so every foreign key recorded in a child row still points
    // at the right parent once that child is reinserted below.
    if (t.users.length) await tx.user.createMany({ data: t.users as never[] });
    if (t.categories.length) await tx.category.createMany({ data: t.categories as never[] });
    if (t.suppliers.length) await tx.supplier.createMany({ data: t.suppliers as never[] });
    if (t.products.length) await tx.product.createMany({ data: t.products as never[] });
    if (t.batches.length) await tx.batch.createMany({ data: t.batches as never[] });
    if (t.batchWriteOffs.length) await tx.batchWriteOff.createMany({ data: t.batchWriteOffs as never[] });
    if (t.purchases.length) await tx.purchase.createMany({ data: t.purchases as never[] });
    if (t.purchaseItems.length) await tx.purchaseItem.createMany({ data: t.purchaseItems as never[] });
    if (t.sales.length) await tx.sale.createMany({ data: t.sales as never[] });
    if (t.saleItems.length) await tx.saleItem.createMany({ data: t.saleItems as never[] });
    if (t.returns.length) await tx.return.createMany({ data: t.returns as never[] });
    if (t.returnItems.length) await tx.returnItem.createMany({ data: t.returnItems as never[] });
    // Last: it points at batches, users and purchase lines.
    if (t.stockAdjustments.length) await tx.stockAdjustment.createMany({ data: t.stockAdjustments as never[] });

    // createMany with an explicit id never advances the table's own
    // autoincrement sequence — without this, the next INSERT with no
    // explicit id would collide with a restored row.
    const tables = [
      'users', 'categories', 'suppliers', 'products', 'batches', 'batch_write_offs',
      'purchases', 'purchase_items', 'sales', 'sale_items', 'returns', 'return_items',
      'stock_adjustments',
    ];
    for (const table of tables) {
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`,
      );
    }
  });
}

/** Parses the shared `<prefix>YYYY-MM-DDTHH-MM-SS.mmmZ` naming scheme of backup files and uploads folders. */
function stampOf(name: string, prefix: string): number | null {
  const match = name.slice(prefix.length).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d{3})Z/);
  if (!name.startsWith(prefix) || !match) return null;
  const [, day, h, m, s, ms] = match;
  return Date.parse(`${day}T${h}:${m}:${s}.${ms}Z`);
}

/** writeBackup copies uploads right after the JSON, so its folder is stamped moments later. */
const UPLOADS_PAIRING_WINDOW_MS = 10 * 60 * 1000;

async function pairedUploadsDir(backupName: string): Promise<string | null> {
  const backupAt = stampOf(backupName, 'backup-');
  if (backupAt === null) return null;
  const entries = await fs.readdir(config.backupDir).catch(() => [] as string[]);
  const match = entries
    .map((name) => ({ name, at: stampOf(name, 'uploads-') }))
    .filter((e): e is { name: string; at: number } => e.at !== null)
    .filter((e) => e.at >= backupAt && e.at - backupAt < UPLOADS_PAIRING_WINDOW_MS)
    .sort((a, b) => a.at - b.at)[0];
  return match ? path.join(config.backupDir, match.name) : null;
}

/**
 * Restores one file from the backup folder by name — the in-app path behind
 * Settings. Validates fully before the wipe, and snapshots the current state
 * first, so a wrong choice can itself be undone.
 */
export async function restoreFromFile(name: string): Promise<void> {
  if (!/^backup-[\w.-]+\.json$/.test(name)) throw new AppError(400, 'اسم ملف غير صالح');

  let raw: string;
  try {
    raw = await fs.readFile(path.join(config.backupDir, name), 'utf8');
  } catch {
    throw new AppError(404, 'الملف غير موجود');
  }

  let payload: BackupPayload;
  try {
    payload = backupSchema.parse(JSON.parse(raw));
  } catch {
    throw new AppError(400, 'ملف النسخة الاحتياطية تالف أو غير مكتمل');
  }

  // Staged aside first: the safety backup below prunes old copies, and the
  // one being restored may be the oldest.
  const uploads = await pairedUploadsDir(name);
  const staged = uploads ? await fs.mkdtemp(path.join(os.tmpdir(), 'restore-uploads-')) : null;
  try {
    if (uploads && staged) await fs.cp(uploads, staged, { recursive: true });

    await writeBackup();
    await applyRestore(payload);

    // Copied over, not swapped in: a photo added since stays harmlessly on disk.
    if (staged) await fs.cp(staged, config.uploadsDir, { recursive: true, force: true });
  } finally {
    if (staged) await fs.rm(staged, { recursive: true, force: true });
  }
}

/** For the CLI, which reads any path the owner gives it. */
export function parseBackup(raw: string): BackupPayload {
  return backupSchema.parse(JSON.parse(raw));
}
