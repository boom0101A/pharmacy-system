#!/usr/bin/env node
/**
 * Run once, ever — `node scripts/generate-license-keypair.mjs`.
 *
 * Produces the Ed25519 keypair the whole licensing system rests on: the
 * private half stays on this machine only (never shipped, never committed —
 * see .gitignore) and signs every license `generate-license.mjs` issues; the
 * public half gets pasted once into apps/desktop/src/main/license.ts, where
 * it ships inside the client app to verify signatures it can never forge.
 *
 * Regenerating this keypair invalidates every license issued under the old
 * one — every client with an existing key would need a fresh one. That is
 * why this refuses to overwrite an existing private key without --force.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const privateKeyPath = path.join(repoRoot, 'license-private-key.pem');
const force = process.argv.includes('--force');

if (existsSync(privateKeyPath) && !force) {
  console.error(
    `يوجد مفتاح خاص فعلاً في:\n  ${privateKeyPath}\n\n` +
      'توليد مفتاح جديد سيُبطل كل التراخيص الصادرة سابقاً — كل عميل حالي سيحتاج مفتاحاً جديداً.\n' +
      'إن كنت متأكداً، أعد التشغيل مع --force.',
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  mode: 0o600,
});

const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('✓ تم إنشاء زوج المفاتيح.\n');
console.log(`المفتاح الخاص حُفظ في: ${privateKeyPath}`);
console.log('لا تشاركه، ولا تضعه في git (مُستثنى فعلاً في .gitignore)، واحتفظ بنسخة منه في مكان آمن منفصل —');
console.log('لو ضاع هذا الملف، لن تستطيع إصدار تراخيص جديدة متوافقة مع النسخ المفعَّلة سابقاً.\n');
console.log('المفتاح العام — الصقه في apps/desktop/src/main/license.ts مكان PUBLIC_KEY_BASE64:\n');
console.log(publicKeyB64);
