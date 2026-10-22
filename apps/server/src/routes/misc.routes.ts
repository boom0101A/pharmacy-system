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
      // Archived medicines still belong to the category, but the count matches the inventory.
      include: { _count: { select: { products: { where: { archivedAt: null } } } } },
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

    // Products are never deleted with their category. With ?moveTo they go to
    // that category (archived ones too, so a restored product isn't orphaned);
    // without it the relation's onDelete: SetNull leaves them uncategorised.
    const moveTo = req.query.moveTo === undefined ? null : Number(req.query.moveTo);
    if (moveTo !== null) {
      const target =
        Number.isInteger(moveTo) && moveTo !== id ? await prisma.category.findUnique({ where: { id: moveTo } }) : null;
      if (!target) throw new AppError(400, 'اختر تصنيفاً آخر موجوداً لنقل الأدوية إليه');
    }

    const moved = await prisma.$transaction(async (tx) => {
      const { count } = moveTo !== null
        ? await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: moveTo } })
        : { count: 0 };
      await tx.category.delete({ where: { id } });
      return count;
    });
    res.json({ moved });
  }),
);
