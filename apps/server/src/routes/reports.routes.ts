import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { resolveRange } from '../lib/dateRange.js';
import {
  getProfitReport,
  getRevenueByCategory,
  getSoldProducts,
  getTopProducts,
  getWriteOffsReport,
} from '../services/reports.service.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);
reportsRouter.use(checkRole('admin', 'pharmacist'));

const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * Baghdad-day buckets: `sales.date` is UTC, so grouping by the raw date would
 * split a single local day across two calendar days near midnight. Shifting
 * by the fixed offset before truncating re-anchors each row to its actual
 * Baghdad day, mirroring the same correction `resolveRange` applies to the
 * query bounds.
 */
function baghdadDay(column: string): string {
  return `(${column} + interval '3 hours')::date`;
}

reportsRouter.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);

    const rows = await prisma.$queryRawUnsafe<{ day: Date; total: string; count: bigint }[]>(
      `SELECT ${baghdadDay('date')} AS day, SUM(total)::text AS total, COUNT(*)::bigint AS count
       FROM sales WHERE date BETWEEN $1 AND $2
       GROUP BY 1 ORDER BY 1`,
      start,
      end,
    );

    res.json(
      rows.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        total: Number(r.total),
        count: Number(r.count),
      })),
    );
  }),
);

reportsRouter.get(
  '/top-products',
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);
    res.json(await getTopProducts(start, end));
  }),
);

reportsRouter.get(
  '/sold-products',
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);
    res.json(await getSoldProducts(start, end));
  }),
);

reportsRouter.get(
  '/by-category',
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);
    res.json(await getRevenueByCategory(start, end));
  }),
);

reportsRouter.get(
  '/expiry',
  asyncHandler(async (req, res) => {
    const { to } = rangeSchema.parse(req.query);
    // `to` is an expiry cut-off here, not a sales window.
    const cutoff = to ?? new Date(Date.now() + 60 * 86_400_000);

    const rows = await prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: cutoff }, product: { archivedAt: null } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 200,
    });

    res.json(
      rows.map((b) => ({
        productId: b.product.id,
        productName: b.product.name,
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate!.toISOString(),
        quantity: b.quantity,
      })),
    );
  }),
);

reportsRouter.get(
  '/low-stock',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: { archivedAt: null },
      include: { batches: { select: { quantity: true } } },
    });

    res.json(
      rows
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          stock: p.batches.reduce((sum, b) => sum + b.quantity, 0),
          reorderLevel: p.reorderLevel,
        }))
        .filter((p) => p.stock <= p.reorderLevel)
        .sort((a, b) => a.stock - b.stock),
    );
  }),
);

/** A simple audit log, not a bucketed chart — every entry is rare enough that no date range or pagination is needed yet. */
reportsRouter.get(
  '/write-offs',
  asyncHandler(async (_req, res) => {
    res.json(await getWriteOffsReport());
  }),
);

reportsRouter.get(
  '/profit',
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);
    res.json(await getProfitReport(start, end));
  }),
);
