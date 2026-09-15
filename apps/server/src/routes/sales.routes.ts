import { Router } from 'express';
import { z } from 'zod';
import { prisma, toNumber } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { createSale } from '../services/sales.service.js';
import { resolveRange } from '../lib/dateRange.js';
import { parseIdParam } from '../lib/parseIdParam.js';

export const salesRouter = Router();
salesRouter.use(requireAuth);

// Cash only: no payment type, no customer, no due date.
const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        isSubUnit: z.boolean().optional(),
      }),
    )
    .min(1, 'الفاتورة فارغة'),
  discount: z.number().nonnegative().default(0),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = saleSchema.parse(req.body);
    res.status(201).json(await createSale(req.auth!.userId, input));
  }),
);

// A cashier looks up a sale by number to process a return against it — same
// permission level as ringing up the original sale.
salesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findUnique({
      where: { id: parseIdParam(req.params.id, 'معرّف الفاتورة') },
      include: {
        items: {
          include: { product: { select: { name: true, unit: true, subUnitName: true } } },
        },
        user: { select: { name: true } },
      },
    });
    if (!sale) throw new AppError(404, 'الفاتورة غير موجودة');

    const returnedByItem = await prisma.returnItem.groupBy({
      by: ['saleItemId'],
      where: { saleItemId: { in: sale.items.map((i) => i.id) } },
      _sum: { quantity: true },
    });
    const returnedMap = new Map(returnedByItem.map((r) => [r.saleItemId, r._sum.quantity ?? 0]));

    res.json({
      id: sale.id,
      userId: sale.userId,
      userName: sale.user.name,
      date: sale.date.toISOString(),
      total: toNumber(sale.total),
      discount: toNumber(sale.discount),
      items: sale.items.map((i) => ({
        id: i.id,
        saleId: i.saleId,
        productId: i.productId,
        productName: i.product.name,
        batchId: i.batchId,
        quantity: i.quantity,
        unitPrice: toNumber(i.unitPrice),
        isSubUnit: i.isSubUnit,
        // 'وحدة' covers a product whose divisibility was switched off after
        // these strips were sold — the old invoice stays readable.
        unitLabel: i.isSubUnit ? (i.product.subUnitName ?? 'وحدة') : i.product.unit,
        returnedQuantity: returnedMap.get(i.id) ?? 0,
      })),
    });
  }),
);

// Sales history exposes takings, so it stays with the manager and pharmacist.
salesRouter.get(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    // `to` is a bare date from an <input type="date">, which coerces to
    // midnight UTC — resolveRange extends it through end-of-day so today's
    // sales aren't excluded before they've even happened.
    const { start, end } = resolveRange(from, to);

    const rows = await prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: { items: true, user: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });

    res.json(
      rows.map((sale) => ({
        id: sale.id,
        userId: sale.userId,
        userName: sale.user.name,
        date: sale.date.toISOString(),
        total: toNumber(sale.total),
        discount: toNumber(sale.discount),
        items: sale.items.map((i) => ({
          id: i.id,
          saleId: i.saleId,
          productId: i.productId,
          batchId: i.batchId,
          quantity: i.quantity,
          unitPrice: toNumber(i.unitPrice),
          isSubUnit: i.isSubUnit,
        })),
      })),
    );
  }),
);
