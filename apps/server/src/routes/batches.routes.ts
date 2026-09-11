import { Router } from 'express';
import { z } from 'zod';
import { prisma, toNumber } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { broadcastStockChanged } from '../sockets/stock.js';

export const batchesRouter = Router();
batchesRouter.use(requireAuth);

const batchSchema = z.object({
  productId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1).nullish(),
  expiryDate: z.coerce.date().nullish(),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().nonnegative().default(0),
});

batchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    const rows = await prisma.batch.findMany({
      where: productId ? { productId } : {},
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
    });

    res.json(
      rows.map((b) => ({
        id: b.id,
        productId: b.productId,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate?.toISOString() ?? null,
        quantity: b.quantity,
        purchasePrice: toNumber(b.purchasePrice),
        receivedAt: b.receivedAt.toISOString(),
        openedSubUnits: b.openedSubUnits,
      })),
    );
  }),
);

/**
 * Receiving stock by hand — a quick fallback next to the supplier-tracked
 * purchase invoice flow, for adjustments that don't need a full invoice.
 */
batchesRouter.post(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const data = batchSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      throw new AppError(404, 'الصنف غير موجود');
    }

    const batch = await prisma.batch.create({
      data: {
        productId: data.productId,
        batchNumber: data.batchNumber || null,
        expiryDate: data.expiryDate ?? null,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
      },
    });

    broadcastStockChanged([batch.productId]);

    res.status(201).json({
      id: batch.id,
      productId: batch.productId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate?.toISOString() ?? null,
      quantity: batch.quantity,
      purchasePrice: toNumber(batch.purchasePrice),
      receivedAt: batch.receivedAt.toISOString(),
      openedSubUnits: batch.openedSubUnits,
    });
  }),
);

/** Expiry date and batch number only — quantity stays out of reach on purpose. */
const batchEditSchema = z.object({
  batchNumber: z.string().trim().min(1).nullish(),
  expiryDate: z.coerce.date().nullish(),
});

batchesRouter.put(
  '/:id',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new AppError(400, 'معرّف الدفعة غير صالح');
    }

    const data = batchEditSchema.parse(req.body);
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'الدفعة غير موجودة');
    }

    // No guard for batches already sold from, unlike delete: the expiry date
    // feeds FEFO ordering and expiry warnings only, never historical cost.
    const batch = await prisma.batch.update({
      where: { id },
      data: {
        batchNumber: data.batchNumber ?? null,
        expiryDate: data.expiryDate ?? null,
      },
    });

    broadcastStockChanged([batch.productId]);

    res.json({
      id: batch.id,
      productId: batch.productId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate?.toISOString() ?? null,
      quantity: batch.quantity,
      purchasePrice: toNumber(batch.purchasePrice),
      receivedAt: batch.receivedAt.toISOString(),
      openedSubUnits: batch.openedSubUnits,
    });
  }),
);

batchesRouter.delete(
  '/:id',
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    const batchId = Number(req.params.id);
    if (!Number.isInteger(batchId)) {
      throw new AppError(400, 'معرّف الدفعة غير صالح');
    }

    // A batch already drawn from by a sale can't be deleted outright: the
    // sale/return history points at it (sale_items.batch_id), and deleting it
    // would either break that foreign key or silently orphan the invoice's
    // cost/expiry trail. Zeroing its quantity keeps the row, its history, and
    // FEFO's ordering intact while taking it out of what's sellable.
    const saleCount = await prisma.saleItem.count({ where: { batchId } });
    if (saleCount > 0) {
      throw new AppError(
        409,
        'لا يمكن حذف دفعة بيع منها سابقاً — صفّر كميتها بدلاً من ذلك عبر التعديل',
      );
    }

    const batch = await prisma.batch.delete({ where: { id: batchId } });
    broadcastStockChanged([batch.productId]);
    res.status(204).end();
  }),
);
