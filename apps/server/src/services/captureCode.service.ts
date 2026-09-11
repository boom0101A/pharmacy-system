import { randomBytes } from 'node:crypto';
import { signCaptureToken } from '../middleware/auth.js';

/**
 * Short, single-use codes for the `/c/:code` link a QR code carries — a raw
 * JWT is too long to fit comfortably in a QR code a phone camera can read
 * reliably from a few steps away, so the code is a lookup key instead.
 */
const codes = new Map<string, { productId: number; expiresAt: number }>();

const CODE_TTL_MS = 10 * 60 * 1000;

export function createCaptureCode(productId: number): string {
  const code = randomBytes(6).toString('hex');
  codes.set(code, { productId, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Consumes the code — good for exactly one redirect, like the token it stands in for. */
export function resolveCaptureCode(code: string): { productId: number; token: string } | null {
  const entry = codes.get(code);
  codes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return { productId: entry.productId, token: signCaptureToken(entry.productId) };
}
