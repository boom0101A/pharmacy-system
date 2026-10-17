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
import { isDirectCliRun } from '../src/lib/directRun.js';
import { prisma } from '../src/prisma.js';
import { config } from '../src/config.js';
import { writeBackup } from '../src/backup.js';
import { applyRestore, parseBackup, type BackupPayload } from '../src/services/restore.service.js';

export { applyRestore };

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
    payload = parseBackup(await fs.readFile(filePath, 'utf8'));
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
if (isDirectCliRun(import.meta.url, process.argv[1], 'restore')) {
  main()
    .catch((err) => {
      console.error('\nفشلت الاستعادة — لم يُغيَّر شيء (المعاملة كاملة أُلغيت):');
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}