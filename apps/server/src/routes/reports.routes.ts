import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { resolveRange } from '../lib/dateRange.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';
import { getWriteOffsReport } from '../services/reports.service.js';

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

    const rows = await prisma.$queryRaw<
      { product_id: number; product_name: string; quantity: bigint; revenue: string }[]
    >`
      SELECT si.product_id, p.name AS product_name,
             SUM(si.quantity)::bigint AS quantity,
             SUM(si.quantity * si.unit_price)::text AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.date BETWEEN ${start} AND ${end}
      GROUP BY si.product_id, p.name
      ORDER BY revenue DESC
      LIMIT 10`;

    res.json(
      rows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
      })),
    );
  }),
);

reportsRouter.get(
  '/by-category',
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);

    const rows = await prisma.$queryRaw<{ category_name: string; revenue: string }[]>`
      SELECT COALESCE(c.name, 'بلا تصنيف') AS category_name,
             SUM(si.quantity * si.unit_price)::text AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.date BETWEEN ${start} AND ${end}
      GROUP BY c.name
      ORDER BY revenue DESC`;

    res.json(rows.map((r) => ({ categoryName: r.category_name, revenue: Number(r.revenue) })));
  }),
);

reportsRouter.get(
  '/expiry',
  asyncHandler(async (req, res) => {
    const { to } = rangeSchema.parse(req.query);
    // `to` is an expiry cut-off here, not a sales window.
    const cutoff = to ?? new Date(Date.now() + 60 * 86_400_000);

    const rows = await prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: cutoff } },
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

/**
 * Revenue comes from `sales.total`, which is already net of the invoice
 * discount — summing the line prices instead would report a profit the till
 * never saw. Returns are subtracted from both sides: the refund leaves the
 * drawer, and the goods come back into stock, so their cost is no longer spent.
 *
 * Each amount is aggregated in its own CTE because joining sales to sale_items
 * would repeat the invoice total once per line and inflate the revenue.
 */
reportsRouter.get(
  '/profit',
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const { start, end } = resolveRange(from, to);

    const revenueByDay = await prisma.$queryRawUnsafe<{ day: Date; revenue: string }[]>(
      `SELECT ${baghdadDay('date')} AS day, SUM(total)::text AS revenue
       FROM sales WHERE date BETWEEN $1 AND $2 GROUP BY 1`,
      start,
      end,
    );
    const returnsByDay = await prisma.$queryRawUnsafe<{ day: Date; refunded: string }[]>(
      `SELECT ${baghdadDay('date')} AS day, SUM(total)::text AS refunded
       FROM returns WHERE date BETWEEN $1 AND $2 GROUP BY 1`,
      start,
      end,
    );
    const costByDay = await prisma.$queryRawUnsafe<{ day: Date; cost: string }[]>(
      `SELECT ${baghdadDay('s.date')} AS day,
              SUM(si.quantity * COALESCE(b.purchase_price, p.purchase_price))::text AS cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       LEFT JOIN batches b ON b.id = si.batch_id
       WHERE s.date BETWEEN $1 AND $2
       GROUP BY 1`,
      start,
      end,
    );

    const days = new Map<string, { revenue: number; refunded: number; cost: number }>();
    for (const r of revenueByDay) {
      const key = r.day.toISOString().slice(0, 10);
      days.set(key, { revenue: Number(r.revenue), refunded: 0, cost: 0 });
    }
    for (const r of returnsByDay) {
      const key = r.day.toISOString().slice(0, 10);
      const entry = days.get(key) ?? { revenue: 0, refunded: 0, cost: 0 };
      entry.refunded = Number(r.refunded);
      days.set(key, entry);
    }
    for (const r of costByDay) {
      const key = r.day.toISOString().slice(0, 10);
      const entry = days.get(key) ?? { revenue: 0, refunded: 0, cost: 0 };
      entry.cost = Number(r.cost);
      days.set(key, entry);
    }

    const points = [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        const revenueMinor = toMinorUnits(v.revenue - v.refunded);
        const costMinor = toMinorUnits(v.cost);
        return {
          date,
          revenue: fromMinorUnits(revenueMinor),
          cost: fromMinorUnits(costMinor),
          profit: fromMinorUnits(revenueMinor - costMinor),
        };
      });

    res.json(points);
  }),
);
