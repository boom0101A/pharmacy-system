import { describe, expect, it } from 'vitest';
import { maskSalesForRole } from './dashboard.service.js';

describe('maskSalesForRole', () => {
  it('passes today\'s sales figures through for admin', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'admin')).toEqual({ total: 15000, count: 3 });
  });

  it('passes today\'s sales figures through for pharmacist', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'pharmacist')).toEqual({ total: 15000, count: 3 });
  });

  it('zeroes today\'s sales figures for cashier — the dashboard stays visible for low-stock/expiry, but money figures do not', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'cashier')).toEqual({ total: 0, count: 0 });
  });
});

describe('lowStockList', async () => {
  const { prisma } = await import('../prisma.js');
  const { lowStockList } = await import('./dashboard.service.js');

  it('finds a low-stock product even when the catalogue has more than 200 products', async () => {
    await prisma.product.createMany({
      data: Array.from({ length: 210 }, (_, i) => ({ name: `أ-${i}`, salePrice: '1', purchasePrice: '1' })),
    });
    const low = await prisma.product.create({ data: { name: 'ي-منخفض', salePrice: '1', purchasePrice: '1', reorderLevel: 10 } });
    await prisma.batch.create({ data: { productId: low.id, quantity: 2 } });

    const rows = await lowStockList(6);

    expect(rows.map((r) => r.id)).toContain(low.id);
  });

  it('ignores expired stock, matching what can actually be sold', async () => {
    const p = await prisma.product.create({ data: { name: 'منتهي', salePrice: '1', purchasePrice: '1', reorderLevel: 3 } });
    await prisma.batch.create({ data: { productId: p.id, quantity: 50, expiryDate: new Date(Date.now() - 5 * 86_400_000) } });
    await prisma.batch.create({ data: { productId: p.id, quantity: 1 } });

    const rows = await lowStockList(6);

    expect(rows.find((r) => r.id === p.id)?.value).toBe(1);
  });
});
