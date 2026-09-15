import { Router } from 'express';
import { prisma, toNumber } from '../prisma.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { productStats } from '../services/products.service.js';
import { maskSalesForRole } from '../services/dashboard.service.js';
import { startOfTodayBaghdad } from '../lib/dateRange.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

const EXPIRY_WARNING_DAYS = 30;

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const startOfDay = startOfTodayBaghdad();

    const [todaySales, stats, lowStockRows, expiringRows] = await Promise.all([
      prisma.sale.aggregate({
        where: { date: { gte: startOfDay } },
        _sum: { total: true },
        _count: true,
      }),
      productStats(),
      prisma.product.findMany({
        include: { batches: { select: { quantity: true } } },
        take: 200,
      }),
      prisma.batch.findMany({
        where: {
          quantity: { gt: 0 },
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000) },
        },
        include: { product: { select: { id: true, name: true } } },
        orderBy: { expiryDate: 'asc' },
        take: 6,
      }),
    ]);

    const lowStock = lowStockRows
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.batches.reduce((sum, b) => sum + b.quantity, 0),
        reorderLevel: p.reorderLevel,
      }))
      .filter((p) => p.stock > 0 && p.stock <= p.reorderLevel)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);

    const sales = maskSalesForRole(
      {
        total: todaySales._sum.total ? toNumber(todaySales._sum.total) : 0,
        count: todaySales._count,
      },
      req.auth!.role,
    );

    res.json({
      todaySalesTotal: sales.total,
      todaySalesCount: sales.count,
      lowStockCount: stats.low,
      expiringSoonCount: stats.expiring,
      lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, value: p.stock })),
      // Keyed by batch, not product — the same medicine can have more than one
      // batch expiring soon, and reusing the product id would collide.
      expiringSoon: expiringRows.map((b) => ({
        id: b.id,
        name: b.product.name,
        value: Math.ceil((b.expiryDate!.getTime() - Date.now()) / 86_400_000),
      })),
    });
  }),
);
