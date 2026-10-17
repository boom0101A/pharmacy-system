import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/errors.js';

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(401, 'الحساب غير مفعّل');

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'كلمة المرور الحالية غير صحيحة');
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'اختر كلمة مرور مختلفة عن الحالية');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
}
