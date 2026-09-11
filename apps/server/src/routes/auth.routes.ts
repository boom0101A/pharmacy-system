import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Every device on the pharmacy's own router can reach this endpoint — nothing
 * stops one of them from trying thousands of passwords a second otherwise.
 * Counts by IP, so a locked-out cashier till doesn't affect any other device
 * on the network. Off in tests: they authenticate via signToken() directly and
 * never hit this route, but a stray future test doing dozens of real logins
 * shouldn't start failing on attempt eleven.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'محاولات دخول كثيرة جداً — حاول مرة أخرى بعد 15 دقيقة' },
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });

    // Same message either way so a wrong username cannot be told from a wrong password.
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    res.json({
      token: signToken({ userId: user.id, role: user.role }),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !user.isActive) throw new AppError(401, 'الحساب غير مفعّل');

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    });
  }),
);
