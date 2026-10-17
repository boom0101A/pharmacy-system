import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { User } from '@pharmacy/shared-types';
import { prisma } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { parseIdParam } from '../lib/parseIdParam.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);
// Managing who can log in — and as what role — is an admin-only capability.
usersRouter.use(checkRole('admin'));

const ROLES = ['admin', 'pharmacist', 'cashier'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(4, 'كلمة المرور قصيرة جداً'),
  role: z.enum(ROLES),
});

const updateSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  role: z.enum(ROLES),
  isActive: z.boolean(),
  // Blank/omitted keeps the current password — only re-hash when one is sent.
  password: z.string().min(4, 'كلمة المرور قصيرة جداً').optional(),
});

/** Never send passwordHash to the client. */
function present(row: {
  id: number;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role as User['role'],
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
  };
}

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    res.json(rows.map(present));
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: data.role,
        mustChangePassword: true,
      },
    });
    res.status(201).json(present(user));
  }),
);

usersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const targetId = parseIdParam(req.params.id, 'معرّف المستخدم');
    const data = updateSchema.parse(req.body);

    // Guards against locking yourself out: you can't demote yourself off
    // admin or deactivate the account you're currently signed in as.
    if (targetId === req.auth!.userId) {
      if (data.role !== 'admin') {
        throw new AppError(400, 'لا يمكنك تغيير دور حسابك الخاص');
      }
      if (!data.isActive) {
        throw new AppError(400, 'لا يمكنك تعطيل حسابك الخاص');
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        name: data.name,
        role: data.role,
        isActive: data.isActive,
        // Your own password changed here is one you chose yourself.
        ...(data.password
          ? { passwordHash: await bcrypt.hash(data.password, 10), mustChangePassword: targetId !== req.auth!.userId }
          : {}),
      },
    });
    res.json(present(user));
  }),
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const targetId = parseIdParam(req.params.id, 'معرّف المستخدم');
    if (targetId === req.auth!.userId) {
      throw new AppError(400, 'لا يمكنك حذف حسابك الخاص');
    }

    // A user with prior sales/purchases can't be deleted (FK restrict) — the
    // shared P2003 handler turns that into a clear 409, same as suppliers.
    await prisma.user.delete({ where: { id: targetId } });
    res.status(204).end();
  }),
);
