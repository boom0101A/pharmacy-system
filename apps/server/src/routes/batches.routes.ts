import { Router } from 'express';
import { z } from 'zod';
import { prisma, toNumber } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { broadcastStockChanged } from '../sockets/stock.js';
import { deleteBatch, writeOffBatch } from '../services/batches.service.js';
import { parseIdParam } from '../lib/parseIdParam.js';

export const batchesRouter = Router();
batchesRouter.use(requireAuth);

export const batchSchema = z.object({
  productId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1).nullish(),
  expiryDate: z.coerce.date().nullish(),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().nonnegative().finite().default(0),
});

batchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // A garbage ?productId= must not silently fall back to "no filter" and
    // return every batch in the pharmacy — Number('abc') is NaN, which is
    // falsy, so the old `productId ? ... : {}` check would have done exactly that.
    const productId =
      req.query.productId !== undefined
        ? parseIdParam(String(req.query.productId), 'معرّف الصنف')
        : undefined;
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

batchesRouter.post(
  '/:id/write-off',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new AppError(400, 'معرّف الدفعة غير صالح');
    }

    const batch = await writeOffBatch(id, req.auth!.userId);
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

    const batch = await deleteBatch(batchId);
    broadcastStockChanged([batch.productId]);
    res.status(204).end();
  }),
);
