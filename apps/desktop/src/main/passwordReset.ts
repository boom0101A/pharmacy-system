import { createHmac } from 'node:crypto';
import { isLoopbackUrl } from './ipcValidation.js';

/** Must match PASSWORD_RESET_SCOPE in apps/server/src/services/passwordReset.service.ts. */
const PASSWORD_RESET_SCOPE = 'password-reset';
const TOKEN_TTL_SECONDS = 300;

export interface ResetDeps {
  /** Proof of ownership: a license key that verifies against *this* machine. */
  isLicenseKeyValid: (key: string) => boolean;
  /** The server's JWT secret — only the main till (which runs the server) has it. */
  readJwtSecret: () => string | null;
  fetch: typeof fetch;
}

export interface ResetInput {
  username: string;
  licenseKey: string;
  newPassword: string;
  serverUrl: string;
}

/** A plain HS256 JWT — the same format jsonwebtoken verifies on the server, without shipping that package in the desktop app. */
function signHs256(payload: object, secret: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

export async function resetPassword(input: ResetInput, deps: ResetDeps): Promise<void> {
  if (!deps.isLicenseKeyValid(input.licenseKey.trim())) {
    throw new Error('مفتاح الترخيص غير صحيح لهذا الجهاز');
  }

  const secret = deps.readJwtSecret();
  // The token is signed with the server's own secret; sent anywhere else it
  // would hand a working reset credential to whoever runs that address.
  if (!secret || !isLoopbackUrl(input.serverUrl)) {
    throw new Error('إعادة تعيين كلمة المرور متاحة فقط من الجهاز الرئيسي الذي يشغّل الخادم');
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signHs256(
    { scope: PASSWORD_RESET_SCOPE, username: input.username.trim(), iat: now, exp: now + TOKEN_TTL_SECONDS },
    secret,
  );

  let res: Response;
  try {
    res = await deps.fetch(`${input.serverUrl.replace(/\/$/, '')}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: input.newPassword }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم — تحقّق من أنه يعمل');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'تعذّرت إعادة تعيين كلمة المرور');
  }
}
