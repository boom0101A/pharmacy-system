import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      // Lets the delete confirmation say how many products it will unlink
      // without anyone having to fetch the whole catalogue to count them.
      include: { _count: { select: { products: true } } },
    });

    res.json(
      rows.map((row) => ({ id: row.id, name: row.name, productCount: row._count.products })),
    );
  }),
);

categoriesRouter.post(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    res.status(201).json(await prisma.category.create({ data: { name } }));
  }),
);

categoriesRouter.delete(
  '/:id',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new AppError(400, 'معرّف التصنيف غير صالح');
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError(404, 'التصنيف غير موجود');
    }

    // Products keep existing — the relation is onDelete: SetNull, so they
    // just lose the link rather than being deleted along with the category.
    await prisma.category.delete({ where: { id } });
    res.status(204).end();
  }),
);
