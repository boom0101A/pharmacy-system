/**
 * Restores the database from a backup file written by src/backup.ts.
 *
 * Usage:
 *   npm run db:restore                        # lists available backups
 *   npm run db:restore -- <backup-filename>    # restores from one of them
 *
 * This WIPES every row in every table before reloading — see the confirmation
 * prompt below for why it exists and cannot be skipped.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { prisma } from '../src/prisma.js';
import { config } from '../src/config.js';
import { writeBackup } from '../src/backup.js';

interface BackupPayload {
  createdAt: string;
  tables: {
    users: unknown[];
    categories: unknown[];
    products: unknown[];
    batches: unknown[];
    suppliers: unknown[];
    purchases: unknown[];
    purchaseItems: unknown[];
    sales: unknown[];
    saleItems: unknown[];
    returns: unknown[];
    returnItems: unknown[];
  };
}

/** The database name out of DATABASE_URL, for the confirmation prompt — never printed from anywhere else, so what's on screen always matches what's about to be wiped. */
function targetDatabaseName(): string {
  const url = new URL(config.databaseUrl);
  return url.pathname.replace(/^\//, '') || '(غير معروف)';
}

async function listBackups(): Promise<string[]> {
  try {
    const files = await fs.readdir(config.backupDir);
    return files.filter((f) => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
  } catch {
    return [];
  }
}

/**
 * The actual wipe-and-reload, split out from `main()` so it can be exercised
 * directly (see restore.test-drive.mjs) without going through the CLI's TTY
 * confirmation prompt — that prompt has nothing to do with the correctness
 * of the delete/recreate/reseq-sequence logic itself.
 */
export async function applyRestore(payload: BackupPayload): Promise<void> {
  const t = payload.tables;
  await prisma.$transaction(async (tx) => {
    // Children before parents, so no foreign key ever points at a row that's
    // about to disappear.
    await tx.returnItem.deleteMany();
    await tx.return.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.sale.deleteMany();
    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();
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
    if (t.purchases.length) await tx.purchase.createMany({ data: t.purchases as never[] });
    if (t.purchaseItems.length) await tx.purchaseItem.createMany({ data: t.purchaseItems as never[] });
    if (t.sales.length) await tx.sale.createMany({ data: t.sales as never[] });
    if (t.saleItems.length) await tx.saleItem.createMany({ data: t.saleItems as never[] });
    if (t.returns.length) await tx.return.createMany({ data: t.returns as never[] });
    if (t.returnItems.length) await tx.returnItem.createMany({ data: t.returnItems as never[] });

    // createMany with an explicit id never advances the table's own
    // autoincrement sequence — without this, the next INSERT with no
    // explicit id would collide with a restored row.
    const tables = [
      'users', 'categories', 'suppliers', 'products', 'batches',
      'purchases', 'purchase_items', 'sales', 'sale_items', 'returns', 'return_items',
    ];
    for (const table of tables) {
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`,
      );
    }
  });
}

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    const backups = await listBackups();
    if (backups.length === 0) {
      console.log(`لا توجد نسخ احتياطية في ${config.backupDir}`);
      return;
    }
    console.log('النسخ الاحتياطية المتوفرة (الأحدث أولاً):\n');
    for (const name of backups) console.log(`  ${name}`);
    console.log('\nللاستعادة: npm run db:restore -- <اسم الملف>');
    return;
  }

  const filePath = path.isAbsolute(filename) ? filename : path.join(config.backupDir, filename);
  let payload: BackupPayload;
  try {
    payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    console.error(`تعذّرت قراءة ${filePath}: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`قاعدة البيانات الهدف: ${targetDatabaseName()}`);
  console.log(`تاريخ النسخة: ${payload.createdAt}`);
  console.log('\n⚠ هذا سيمسح كل البيانات الحالية ويستبدلها بمحتوى هذا الملف. لا يمكن التراجع.');

  // A script run from a service, a cron job, or piped input has no one to
  // confirm anything — refusing by default is the only safe behavior.
  if (!process.stdin.isTTY) {
    console.error('\nالتشغيل غير تفاعلي — أُلغيت العملية تلقائياً.');
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nاكتب RESTORE للمتابعة: ');
  rl.close();
  if (answer !== 'RESTORE') {
    console.log('أُلغيت العملية.');
    return;
  }

  console.log('\nأخذ نسخة أمان للوضع الحالي قبل المسح…');
  const safetyFile = await writeBackup();
  console.log(`تم: ${safetyFile}`);

  console.log('جارٍ الاستعادة…');
  await applyRestore(payload);

  console.log('\nتمت الاستعادة بنجاح.');
}

// Only runs when this file is executed directly (`tsx scripts/restore.ts`) —
// `applyRestore` above is also imported directly by the test-drive script,
// which must not trigger a second, unwanted CLI run (with its own prisma
// disconnect) as a side effect of that import. `process.argv[1]` is a bare
// relative path as tsx hands it to us, not a URL — pathToFileURL resolves
// and encodes it (drive letter, spaces, backslashes) the same way Node
// resolves `import.meta.url`, so the two are actually comparable.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      console.error('\nفشلت الاستعادة — لم يُغيَّر شيء (المعاملة كاملة أُلغيت):');
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
