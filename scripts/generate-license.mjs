#!/usr/bin/env node
/**
 * The quick tool — `node scripts/generate-license.mjs` — for issuing one
 * license key to one client's machine. Needs license-private-key.pem, which
 * only exists on the machine that ran generate-license-keypair.mjs; never
 * copy that file anywhere the client could reach it.
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const privateKeyPath = path.join(repoRoot, 'license-private-key.pem');
const licensesDir = path.join(repoRoot, 'licenses');

if (!existsSync(privateKeyPath)) {
  console.error(
    `لا يوجد مفتاح خاص في:\n  ${privateKeyPath}\n\n` +
      'شغّل أولاً (مرة واحدة فقط): node scripts/generate-license-keypair.mjs',
  );
  process.exit(1);
}

const privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'));

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

const expiresInput = (
  await ask('تاريخ الانتهاء (YYYY-MM-DD)، أو اتركه فارغاً لترخيص دائم: ')
).trim();
let expiresAt = null;
if (expiresInput) {
  const parsed = new Date(expiresInput);
  if (Number.isNaN(parsed.getTime())) {
    console.error('تاريخ غير صالح — استخدم الصيغة YYYY-MM-DD.');
    process.exit(1);
  }
  expiresAt = parsed.toISOString();
}

rl.close();

const payload = {
  licenseId: randomUUID(),
  licensedTo,
  machineId,
  issuedAt: new Date().toISOString(),
  expiresAt,
};

// Signed as the exact string below — the app verifies these same bytes
// before ever parsing them, so no re-serialization step can drift from this.
const payloadJson = JSON.stringify(payload);
const signature = sign(null, Buffer.from(payloadJson, 'utf8'), privateKey).toString('base64');

const licenseKey = Buffer.from(JSON.stringify({ payload: payloadJson, signature }), 'utf8').toString(
  'base64',
);

mkdirSync(licensesDir, { recursive: true });
const recordPath = path.join(
  licensesDir,
  `${licensedTo.replace(/[^\p{L}\p{N}]+/gu, '-')}-${payload.issuedAt.slice(0, 10)}.lic.txt`,
);
writeFileSync(recordPath, licenseKey);

console.log('\n✓ تم إصدار الترخيص.\n');
console.log(`مرخَّص لـ: ${licensedTo}`);
console.log(`الجهاز: ${machineId}`);
console.log(`الانتهاء: ${expiresAt ?? 'دائم'}`);
console.log(`نسخة محفوظة عندك في: ${recordPath}\n`);
console.log('المفتاح — أرسله للعميل ليلصقه في شاشة التفعيل:\n');
console.log(licenseKey);
