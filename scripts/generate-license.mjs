#!/usr/bin/env node
/**
 * The quick tool — `node scripts/generate-license.mjs` — for issuing one
 * license key to one client's machine. Needs license-private-key.pem, which
 * only exists on the machine that ran generate-license-keypair.mjs; never
 * copy that file anywhere the client could reach it.
 */
import { existsSync } from 'node:fs';
import readline from 'node:readline';
import { issueLicense, LicenseIssueError, privateKeyPath } from './lib/issue-license.mjs';

if (!existsSync(privateKeyPath)) {
  console.error(
    `لا يوجد مفتاح خاص في:\n  ${privateKeyPath}\n\n` +
      'شغّل أولاً (مرة واحدة فقط): node scripts/generate-license-keypair.mjs',
  );
  process.exit(1);
}

/*
 * A hand-rolled question queue instead of `readline/promises`'s built-in
 * `question()`: that version re-arms its listener fresh on every call, so a
 * line that arrives before the *next* call attaches — normal when input is
 * piped or redirected rather than typed live — gets dropped on the floor
 * instead of answering it. Queuing every line as it arrives and handing them
 * out in order means an already-buffered answer is never lost, while a human
 * typing interactively sees no difference at all.
 */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pendingLines = [];
let waitingResolve = null;
rl.on('line', (line) => {
  if (waitingResolve) {
    const resolve = waitingResolve;
    waitingResolve = null;
    resolve(line);
  } else {
    pendingLines.push(line);
  }
});
function ask(prompt) {
  process.stdout.write(prompt);
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  return new Promise((resolve) => {
    waitingResolve = resolve;
  });
}

console.log('=== توليد مفتاح ترخيص جديد ===\n');

const machineId = (await ask('رمز الجهاز (من شاشة التفعيل عند العميل): ')).trim();
if (!machineId) {
  console.error('رمز الجهاز مطلوب.');
  process.exit(1);
}

const licensedTo = (await ask('اسم الصيدلية/العميل: ')).trim();
if (!licensedTo) {
  console.error('اسم العميل مطلوب.');
  process.exit(1);
}

const expiresAtInput = await ask('تاريخ الانتهاء (YYYY-MM-DD)، أو اتركه فارغاً لترخيص دائم: ');

rl.close();

try {
  const { licenseKey, recordPath, payload } = issueLicense({ machineId, licensedTo, expiresAtInput });

  console.log('\n✓ تم إصدار الترخيص.\n');
  console.log(`مرخَّص لـ: ${payload.licensedTo}`);
  console.log(`الجهاز: ${payload.machineId}`);
  console.log(`الانتهاء: ${payload.expiresAt ?? 'دائم'}`);
  console.log(`نسخة محفوظة عندك في: ${recordPath}\n`);
  console.log('المفتاح — أرسله للعميل ليلصقه في شاشة التفعيل:\n');
  console.log(licenseKey);
} catch (err) {
  console.error(err instanceof LicenseIssueError ? err.message : `خطأ غير متوقع: ${err.message}`);
  process.exit(1);
}
