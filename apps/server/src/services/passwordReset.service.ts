import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/errors.js';

/**
 * Must match the desktop's apps/desktop/src/main/passwordReset.ts. Only a
 * process holding JWT_SECRET can mint this — in practice the main till's own
 * Electron process, after it has checked this machine's license key — so a
 * request from anywhere else on the network cannot reset anyone's password.
 */
export const PASSWORD_RESET_SCOPE = 'password-reset';

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  let payload: { scope?: unknown; username?: unknown };
  try {
    payload = jwt.verify(token, config.jwtSecret) as typeof payload;
  } catch {
    throw new AppError(401, 'رمز إعادة التعيين غير صالح أو منتهي — أعد المحاولة');
  }
  if (payload.scope !== PASSWORD_RESET_SCOPE || typeof payload.username !== 'string') {
    throw new AppError(401, 'رمز إعادة التعيين غير صالح أو منتهي — أعد المحاولة');
  }

  const user = await prisma.user.findUnique({ where: { username: payload.username } });
  if (!user) throw new AppError(404, 'لا يوجد مستخدم بهذا الاسم');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      // A disabled admin with a forgotten password would otherwise leave
      // nobody able to manage the system at all.
      ...(user.role === 'admin' ? { isActive: true } : {}),
    },
  });
}
