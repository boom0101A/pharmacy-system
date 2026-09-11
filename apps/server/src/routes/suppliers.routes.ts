import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

const supplierSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().trim().min(1).nullish(),
  address: z.string().trim().min(1).nullish(),
});

suppliersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.supplier.findMany({ orderBy: { name: 'asc' } }));
  }),
);

suppliersRouter.post(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    res.status(201).json(
      await prisma.supplier.create({
        data: { name: data.name, phone: data.phone || null, address: data.address || null },
      }),
    );
  }),
);

suppliersRouter.put(
  '/:id',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    res.json(
      await prisma.supplier.update({
        where: { id: Number(req.params.id) },
        data: { name: data.name, phone: data.phone || null, address: data.address || null },
      }),
    );
  }),
);

suppliersRouter.delete(
  '/:id',
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    await prisma.supplier.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  }),
);
