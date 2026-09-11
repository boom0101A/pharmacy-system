import { execFileSync } from 'node:child_process';
import { createPublicKey, verify } from 'node:crypto';

/**
 * Paste the output of `node scripts/generate-license-keypair.mjs` here.
 * The matching private key never leaves the developer's machine (see
 * scripts/generate-license.mjs) — this public half can only *verify* a
 * signature, never produce one, so shipping it inside the client app cannot
 * let anyone forge a new license from it.
 */
const PUBLIC_KEY_BASE64 = 'MCowBQYDK2VwAyEAX6yv/aJxcROejc8q2IOzXrEmyTabPgJMFO5/Wi0d/30=';

export interface LicensePayload {
  licenseId: string;
  licensedTo: string;
  machineId: string;
  issuedAt: string;
  /** null = perpetual. */
  expiresAt: string | null;
}

interface LicenseKeyEnvelope {
  /** The exact JSON string the signature was computed over — never re-derived, only re-parsed after the signature checks out. */
  payload: string;
  /** base64 Ed25519 signature of `payload`'s UTF-8 bytes. */
  signature: string;
}

export type LicenseCheck =
  | { valid: true; payload: LicensePayload }
  | { valid: false; error: string };

/**
 * Windows assigns this GUID once, at install time, in the registry — it
 * survives reboots and network changes (unlike a MAC address), which is
 * exactly the stability a hardware-locked license needs. Reading it needs no
 * elevated privileges.
 */
export function getMachineId(): string {
  const output = execFileSync(
    'reg',
    ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
    { encoding: 'utf8' },
  );
  const match = output.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
  if (!match) {
    throw new Error('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
  }
  return match[1];
}

/**
 * Pure — no Electron, no filesystem, no ambient state, deliberately kept in a
 * module that imports nothing from `electron`. `import { app } from 'electron'`
 * resolves to something unusable outside a real Electron process, which would
 * make this untestable with a plain `node`/`tsx` script; this file has to stay
 * free of that import so the signature logic can be checked on its own (see
 * the verification step in the plan) instead of only by running the app.
 */
export function verifyLicenseKey(key: string, machineId: string): LicenseCheck {
  let envelope: LicenseKeyEnvelope;
  try {
    envelope = JSON.parse(Buffer.from(key.trim(), 'base64').toString('utf8'));
  } catch {
    return { valid: false, error: 'صيغة مفتاح الترخيص غير صالحة' };
  }
  if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') {
    return { valid: false, error: 'صيغة مفتاح الترخيص غير صالحة' };
  }

  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(PUBLIC_KEY_BASE64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return { valid: false, error: 'تعذّر تحميل مفتاح التحقق من التوقيع' };
  }

  const signatureOk = verify(
    null,
    Buffer.from(envelope.payload, 'utf8'),
    publicKey,
    Buffer.from(envelope.signature, 'base64'),
  );
  if (!signatureOk) {
    return { valid: false, error: 'مفتاح الترخيص غير صحيح أو تم التلاعب به' };
  }

  // Only trusted once the signature above has actually passed.
  const payload: LicensePayload = JSON.parse(envelope.payload);

  if (payload.machineId !== machineId) {
    return { valid: false, error: 'هذا المفتاح صادر لجهاز آخر — يجب طلب مفتاح جديد لهذا الجهاز' };
  }
  if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: 'انتهت صلاحية هذا المفتاح' };
  }

  return { valid: true, payload };
}
