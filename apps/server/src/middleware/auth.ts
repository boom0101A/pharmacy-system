import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@pharmacy/shared-types';
import { config } from '../config.js';
import { prisma } from '../prisma.js';

export interface AuthPayload {
  userId: number;
  role: Role;
}

/**
 * Marks a token as a narrow, single-purpose grant rather than a login session.
 * Kept as a distinct field so the two kinds can never be confused for one
 * another — see the `scope` rejection in `requireAuth` below.
 */
const CAPTURE_SCOPE = 'product-image-capture';

/** Long enough to walk to the shelf and take the photo, short enough to be worthless if seen. */
export const CAPTURE_TOKEN_TTL_SECONDS = 600;

export interface CapturePayload {
  scope: typeof CAPTURE_SCOPE;
  productId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      /** Set by `requireCaptureToken` — read from the token, never from the request. */
      captureProductId?: number;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  // The lifetime comes from env as a string ("12h"); jsonwebtoken's types want
  // its own literal union for that, so it is asserted here rather than in config.
  const expiresIn = config.jwtExpiresIn as SignOptions['expiresIn'];
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Signs the token embedded in the QR code the desktop shows. It carries no
 * role and no user, and names the one product it may write to, so the phone
 * that scans it can do exactly one thing and nothing else.
 */
export function signCaptureToken(productId: number): string {
  const payload: CapturePayload = { scope: CAPTURE_SCOPE, productId };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: CAPTURE_TOKEN_TTL_SECONDS });
}

/**
 * A login-session token for a live, active user, or the Arabic reason it is
 * not one. Shared by HTTP (`requireAuth`) and the stock socket.
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<{ auth: AuthPayload } | { error: string }> {
  if (!token) return { error: 'مطلوب تسجيل الدخول' };

  let payload: AuthPayload & { scope?: string };
  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthPayload & { scope?: string };
  } catch {
    return { error: 'الجلسة منتهية، سجّل الدخول من جديد' };
  }

  // A scoped grant (the phone-capture token) is signed with the same secret
  // but is not a session. Without this check it would satisfy every route
  // that only calls requireAuth — the product catalogue included.
  if (payload.scope) return { error: 'مطلوب تسجيل الدخول' };

  // The signature alone is not enough: an account disabled or demoted after
  // its token was issued has to lose access now, not in twelve hours.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return { error: 'الحساب غير مفعّل — راجع مدير النظام' };

  return { auth: { userId: user.id, role: user.role } };
}

/** Rejects any request without a valid bearer token for a live, active user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  try {
    const result = await verifySessionToken(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if ('error' in result) return res.status(401).json({ error: result.error });
    req.auth = result.auth;
    next();
  } catch (err) {
    // An async middleware has to hand errors to Express itself.
    next(err);
  }
}

/**
 * Guards the phone-facing capture routes. The product id comes out of the
 * signed token itself, so a token minted for one product can never be pointed
 * at another by editing the request.
 */
export function requireCaptureToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'رابط غير صالح' });
  }

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as Partial<CapturePayload>;
    if (payload.scope !== CAPTURE_SCOPE || typeof payload.productId !== 'number') {
      return res.status(401).json({ error: 'رابط غير صالح' });
    }

    req.captureProductId = payload.productId;
    next();
  } catch {
    return res.status(401).json({ error: 'انتهت صلاحية الرمز — أعد عرض رمز QR من التطبيق' });
  }
}

/**
 * Role gate enforced on the server, not merely by hiding buttons in the UI —
 * a hidden button does not stop a direct request to the endpoint.
 */
export function checkRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'لا تملك صلاحية لهذا الإجراء' });
    }
    next();
  };
}
