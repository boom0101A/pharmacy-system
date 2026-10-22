import type { SalesHistoryPage } from '@pharmacy/shared-types';
import { prisma, toNumber } from '../prisma.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';

export const HISTORY_MAX_LIMIT = 200;

/**
 * Invoices in a period, newest first, one page at a time — the old
 * `GET /api/sales` stopped at 200, which a busy month passes in days.
 * `count` and `sum` cover the whole period, not just the page shown.
 */
export async function listSalesHistory(options: {
  start: Date;
  end: Date;
  saleId?: number;
  limit: number;
  offset: number;
}): Promise<SalesHistoryPage> {
  const where = {
    date: { gte: options.start, lte: options.end },
    ...(options.saleId ? { id: options.saleId } : {}),
  };

  const [rows, totals] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        user: { select: { name: true } },
        _count: { select: { items: true } },
        returns: { select: { total: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: Math.min(options.limit, HISTORY_MAX_LIMIT),
      skip: options.offset,
    }),
    prisma.sale.aggregate({ where, _count: { _all: true }, _sum: { total: true } }),
  ]);

  return {
    rows: rows.map((sale) => ({
      id: sale.id,
      date: sale.date.toISOString(),
      userName: sale.user.name,
      itemCount: sale._count.items,
      discount: toNumber(sale.discount),
      total: toNumber(sale.total),
      returnedTotal: fromMinorUnits(sale.returns.reduce((sum, r) => sum + toMinorUnits(toNumber(r.total)), 0)),
    })),
    count: totals._count._all,
    sum: totals._sum.total ? toNumber(totals._sum.total) : 0,
  };
}
