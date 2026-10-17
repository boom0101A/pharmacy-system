import type { SoldProductRow, WriteOffReportRow } from '@pharmacy/shared-types';
import { prisma } from '../prisma.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';

export async function getWriteOffsReport(): Promise<WriteOffReportRow[]> {
  const rows = await prisma.batchWriteOff.findMany({
    include: { batch: { include: { product: true } }, user: true },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    productName: r.batch.product.name,
    quantity: r.quantity,
    batchExpiryDate: r.batch.expiryDate?.toISOString() ?? null,
    userName: r.user.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Baghdad-day buckets: `sales.date` is UTC, so grouping by the raw date would
 * split a single local day across two calendar days near midnight.
 */
function baghdadDay(column: string): string {
  return `(${column} + interval '3 hours')::date`;
}

/**
 * Cost of one unit of a sale line, as SQL over `si`/`p`/`b`. A sub-unit line
 * (one strip of a box) costs its share of the package, not the whole package —
 * using the package size snapshotted at sale time, falling back to the
 * product's current one for lines recorded before the snapshot was saved.
 */
const LINE_UNIT_COST = `(COALESCE(b.purchase_price, p.purchase_price)
  / CASE WHEN si.is_sub_unit THEN COALESCE(si.sub_units_per_package, p.units_per_package, 1) ELSE 1 END)`;

export async function getTopProducts(start: Date, end: Date) {
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
    -- By the number itself: the revenue alias is text, which would rank "9" above "1500".
    ORDER BY SUM(si.quantity * si.unit_price) DESC
    LIMIT 10`;

  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
  }));
}

/**
 * Every product sold in the period — unlike `getTopProducts`, no top-ten cut —
 * net of what came back as returns, with packages and strips kept apart (a
 * strip line's quantity is strips, not boxes). Revenue is at line price,
 * before the invoice-level discount.
 */
export async function getSoldProducts(start: Date, end: Date): Promise<SoldProductRow[]> {
  const rows = await prisma.$queryRaw<
    { product_id: number; product_name: string; sub_unit_name: string | null; packages: bigint; sub_units: bigint; revenue: string }[]
  >`
    WITH net AS (
      SELECT si.product_id, si.is_sub_unit, si.unit_price,
             si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date BETWEEN ${start} AND ${end}
    )
    SELECT n.product_id, p.name AS product_name, p.sub_unit_name,
           COALESCE(SUM(n.qty) FILTER (WHERE NOT n.is_sub_unit), 0)::bigint AS packages,
           COALESCE(SUM(n.qty) FILTER (WHERE n.is_sub_unit), 0)::bigint AS sub_units,
           SUM(n.qty * n.unit_price)::text AS revenue
    FROM net n
    JOIN products p ON p.id = n.product_id
    WHERE n.qty > 0
    GROUP BY n.product_id, p.name, p.sub_unit_name
    ORDER BY SUM(n.qty * n.unit_price) DESC, p.name`;

  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    packages: Number(r.packages),
    subUnits: Number(r.sub_units),
    subUnitName: r.sub_unit_name,
    revenue: Number(r.revenue),
  }));
}

export async function getRevenueByCategory(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ category_name: string; revenue: string }[]>`
    SELECT COALESCE(c.name, 'بلا تصنيف') AS category_name,
           SUM(si.quantity * si.unit_price)::text AS revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.date BETWEEN ${start} AND ${end}
    GROUP BY c.name
    ORDER BY SUM(si.quantity * si.unit_price) DESC`;

  return rows.map((r) => ({ categoryName: r.category_name, revenue: Number(r.revenue) }));
}

/**
 * Revenue comes from `sales.total`, which is already net of the invoice
 * discount — summing the line prices instead would report a profit the till
 * never saw. Each amount is aggregated in its own query because joining sales
 * to sale_items would repeat the invoice total once per line.
 */
export async function getProfitReport(start: Date, end: Date) {
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
    `SELECT ${baghdadDay('s.date')} AS day, SUM(si.quantity * ${LINE_UNIT_COST})::text AS cost
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE s.date BETWEEN $1 AND $2
     GROUP BY 1`,
    start,
    end,
  );
  // Returned goods are back on the shelf, so their cost is no longer spent —
  // counted on the day of the return, the same day the refund is.
  const returnedCostByDay = await prisma.$queryRawUnsafe<{ day: Date; cost: string }[]>(
    `SELECT ${baghdadDay('r.date')} AS day, SUM(ri.quantity * ${LINE_UNIT_COST})::text AS cost
     FROM return_items ri
     JOIN returns r ON r.id = ri.return_id
     JOIN sale_items si ON si.id = ri.sale_item_id
     JOIN products p ON p.id = si.product_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE r.date BETWEEN $1 AND $2
     GROUP BY 1`,
    start,
    end,
  );

  const days = new Map<string, { revenue: number; refunded: number; cost: number }>();
  const entry = (day: Date) => {
    const key = day.toISOString().slice(0, 10);
    const existing = days.get(key) ?? { revenue: 0, refunded: 0, cost: 0 };
    days.set(key, existing);
    return existing;
  };
  for (const r of revenueByDay) entry(r.day).revenue = Number(r.revenue);
  for (const r of returnsByDay) entry(r.day).refunded = Number(r.refunded);
  for (const r of costByDay) entry(r.day).cost += Number(r.cost);
  for (const r of returnedCostByDay) entry(r.day).cost -= Number(r.cost);

  return [...days.entries()]
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
}
