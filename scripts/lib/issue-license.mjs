/**
 * The one place the signing logic lives. Both the CLI tool
 * (generate-license.mjs) and the browser GUI (license-gui-server.mjs) call
 * issueLicense() instead of each carrying their own copy — two independent
 * implementations of the same signature construction is how they'd quietly
 * drift apart.
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const privateKeyPath = path.join(repoRoot, 'license-private-key.pem');
export const licensesDir = path.join(repoRoot, 'licenses');

export class LicenseIssueError extends Error {}

export function issueLicense({ machineId, licensedTo, expiresAtInput }) {
  if (!existsSync(privateKeyPath)) {
    throw new LicenseIssueError(
      `لا يوجد مفتاح خاص في:\n${privateKeyPath}\n\n` +
        'شغّل أولاً (مرة واحدة فقط): node scripts/generate-license-keypair.mjs',
    );
  }

  machineId = (machineId ?? '').trim();
  if (!machineId) throw new LicenseIssueError('رمز الجهاز مطلوب.');

  licensedTo = (licensedTo ?? '').trim();
  if (!licensedTo) throw new LicenseIssueError('اسم العميل مطلوب.');

  let expiresAt = null;
  const expiresInput = (expiresAtInput ?? '').trim();
  if (expiresInput) {
    const parsed = new Date(expiresInput);
    if (Number.isNaN(parsed.getTime())) {
      throw new LicenseIssueError('تاريخ غير صالح — استخدم الصيغة YYYY-MM-DD.');
    }
    expiresAt = parsed.toISOString();
  }

  const privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'));

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

  const licenseKey = Buffer.from(
    JSON.stringify({ payload: payloadJson, signature }),
    'utf8',
  ).toString('base64');

  mkdirSync(licensesDir, { recursive: true });
  const recordPath = path.join(
    licensesDir,
    `${licensedTo.replace(/[^\p{L}\p{N}]+/gu, '-')}-${payload.issuedAt.slice(0, 10)}.lic.txt`,
  );
  writeFileSync(recordPath, licenseKey);

  return { licenseKey, recordPath, payload };
}
