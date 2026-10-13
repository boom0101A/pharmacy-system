import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { resetPassword, type ResetDeps } from './passwordReset.js';

const SECRET = 's'.repeat(64);

function deps(overrides: Partial<ResetDeps> = {}): ResetDeps {
  return {
    isLicenseKeyValid: () => true,
    readJwtSecret: () => SECRET,
    fetch: vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
    ...overrides,
  };
}

const input = { username: 'admin', licenseKey: 'KEY', newPassword: 'new-pass', serverUrl: 'http://127.0.0.1:3000' };

function decodeJwt(token: string) {
  const [header, body, signature] = token.split('.');
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return { payload: JSON.parse(Buffer.from(body, 'base64url').toString()), signatureValid: signature === expected };
}

describe('resetPassword', () => {
  it('never contacts the server when the license key is not valid for this machine', async () => {
    const d = deps({ isLicenseKeyValid: () => false });
    await expect(resetPassword(input, d)).rejects.toThrow('مفتاح الترخيص');
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('tells the user to reset from the main till when this machine has no server secret', async () => {
    const d = deps({ readJwtSecret: () => null });
    await expect(resetPassword(input, d)).rejects.toThrow('الجهاز الرئيسي');
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('sends a correctly signed, short-lived password-reset token with the new password', async () => {
    const d = deps();
    await resetPassword(input, d);

    const [url, init] = vi.mocked(d.fetch).mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/auth/reset-password');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.password).toBe('new-pass');
    const { payload, signatureValid } = decodeJwt(body.token);
    expect(signatureValid).toBe(true);
    expect(payload).toMatchObject({ scope: 'password-reset', username: 'admin' });
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
  });

  it('refuses to send the signed reset token anywhere but this machine\'s own server', async () => {
    const d = deps();
    await expect(resetPassword({ ...input, serverUrl: 'http://evil.example' }, d)).rejects.toThrow('الجهاز الرئيسي');
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('surfaces the server\'s own Arabic error message', async () => {
    const d = deps({
      fetch: vi.fn(async () => Response.json({ error: 'لا يوجد مستخدم بهذا الاسم' }, { status: 404 })) as unknown as typeof fetch,
    });
    await expect(resetPassword(input, d)).rejects.toThrow('لا يوجد مستخدم بهذا الاسم');
  });
});
