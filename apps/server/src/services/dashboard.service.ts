import type { Role } from '@pharmacy/shared-types';
import { prisma } from '../prisma.js';

/**
 * The dashboard stays open to every role — a cashier needs the same
 * low-stock/expiry warnings an admin does — but today's revenue is not
 * theirs to see, matching `canSeeProfit` in the desktop Reports page.
 */
export function maskSalesForRole(
  sales: { total: number; count: number },
  role: Role,
): { total: number; count: number } {
  if (role === 'admin' || role === 'pharmacist') return sales;
  return { total: 0, count: 0 };
}

/**
 * Aggregated in SQL over the whole catalogue — fetching an unordered 200
 * products and filtering them in JS silently dropped every low-stock item
 * past that cut, even while the dashboard's own low-stock *count* included
 * them. Only unexpired batches count, matching what a sale can draw from.
 */
export async function lowStockList(limit: number): Promise<{ id: number; name: string; value: number }[]> {
  const rows = await prisma.$queryRaw<{ id: number; name: string; stock: bigint }[]>`
    SELECT p.id, p.name, SUM(b.quantity)::bigint AS stock
    FROM products p
    JOIN batches b ON b.product_id = p.id
    WHERE p.archived_at IS NULL
      AND (b.expiry_date IS NULL OR b.expiry_date >= (now() AT TIME ZONE 'Asia/Baghdad')::date)
    GROUP BY p.id, p.name, p.reorder_level
    HAVING SUM(b.quantity) > 0 AND SUM(b.quantity) <= p.reorder_level
    ORDER BY SUM(b.quantity) ASC, p.name ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, name: r.name, value: Number(r.stock) }));
}
