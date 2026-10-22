import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { resolveRange } from '../../lib/dateRange.js';
import { createReturn } from '../returns.service.js';
import { createSale } from '../sales.service.js';
import { listSalesHistory } from '../salesHistory.service.js';

async function seller() {
  return prisma.user.create({ data: { name: 'علي', username: `c-${Math.random()}`, passwordHash: 'x', role: 'cashier' } });
}

async function stocked() {
  const p = await prisma.product.create({ data: { name: 'بنادول', salePrice: '1000', purchasePrice: '500' } });
  await prisma.batch.create({ data: { productId: p.id, quantity: 1000 } });
  return p;
}

/** A sale moved to a fixed instant, so ranges are predictable. */
async function saleAt(iso: string, userId: number, productId: number, quantity = 1) {
  const sale = await createSale(userId, { items: [{ productId, quantity }] });
  await prisma.sale.update({ where: { id: sale.id }, data: { date: new Date(iso) } });
  return sale;
}

const range = (from: string, to: string) => resolveRange(new Date(from), new Date(to));

describe('sales history', () => {
  it('counts and sums the whole period, while handing it out page by page', async () => {
    const u = await seller();
    const p = await stocked();
    for (let i = 0; i < 5; i++) await saleAt(`2026-09-1${i}T09:00:00Z`, u.id, p.id, i + 1);
    const { start, end } = range('2026-09-01', '2026-09-30');

    const first = await listSalesHistory({ start, end, limit: 2, offset: 0 });
    const third = await listSalesHistory({ start, end, limit: 2, offset: 4 });

    expect(first.count).toBe(5);
    expect(first.sum).toBe(15_000);
    expect(first.rows.map((r) => r.total)).toEqual([5000, 4000]); // newest first
    expect(third.rows).toHaveLength(1);
  });

  it('goes past the old 200-invoice cap', async () => {
    const u = await seller();
    const p = await stocked();
    for (let i = 0; i < 205; i++) {
      await prisma.sale.create({ data: { userId: u.id, total: '1', date: new Date('2026-08-15T09:00:00Z'), items: { create: [{ productId: p.id, quantity: 1, unitPrice: '1' }] } } });
    }
    const { start, end } = range('2026-08-01', '2026-08-31');

    const page = await listSalesHistory({ start, end, limit: 200, offset: 200 });

    expect(page.count).toBe(205);
    expect(page.rows).toHaveLength(5);
  });

  it('puts a 1 a.m. Baghdad sale on its own day', async () => {
    const u = await seller();
    const p = await stocked();
    await saleAt('2026-03-09T22:00:00Z', u.id, p.id); // 01:00 on 10 March in Baghdad
    const tenth = range('2026-03-10', '2026-03-10');

    expect((await listSalesHistory({ ...tenth, limit: 50, offset: 0 })).count).toBe(1);
  });

  it('finds one invoice by its number, and reports what was returned from it', async () => {
    const u = await seller();
    const p = await stocked();
    const sale = await saleAt('2026-07-05T09:00:00Z', u.id, p.id, 3);
    await createReturn(u.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 1 }] });
    const { start, end } = range('2026-07-01', '2026-07-31');

    const found = await listSalesHistory({ start, end, saleId: sale.id, limit: 50, offset: 0 });

    expect(found.rows).toEqual([
      expect.objectContaining({ id: sale.id, userName: 'علي', itemCount: 1, total: 3000, returnedTotal: 1000 }),
    ]);
  });

  it('over HTTP: for the admin and pharmacist, not the cashier', async () => {
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const call = async (role: 'pharmacist' | 'cashier') => {
      const user = await prisma.user.create({ data: { name: 'م', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
      return fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sales/history?from=2026-01-01&to=2026-12-31`, {
        headers: { Authorization: `Bearer ${signToken({ userId: user.id, role })}` },
      });
    };
    try {
      const ok = await call('pharmacist');
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ rows: [], count: 0, sum: 0 });
      expect((await call('cashier')).status).toBe(403);
    } finally {
      server.close();
    }
  });
});
