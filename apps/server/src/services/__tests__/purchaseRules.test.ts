import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { baghdadTodayIso } from '../../lib/dateRange.js';
import { createPurchase } from '../purchases.service.js';

async function fixtures() {
  const user = await prisma.user.create({ data: { name: 'م', username: `u-${Math.random()}`, passwordHash: 'x', role: 'admin' } });
  const supplier = await prisma.supplier.create({ data: { name: 'مذخر' } });
  const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '9000', purchasePrice: '8000' } });
  return { user, supplier, product };
}

function isoDaysFromToday(days: number): string {
  const d = new Date(`${baghdadTodayIso()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

describe('purchase invoice rules', () => {
  it('records a free bonus line without dragging the product\'s reference cost down to zero', async () => {
    const { user, supplier, product } = await fixtures();

    const purchase = await createPurchase(user.id, {
      supplierId: supplier.id,
      items: [
        { productId: product.id, quantity: 10, unitPrice: 7500 },
        { productId: product.id, quantity: 1, unitPrice: 0 },
      ],
    });

    expect(purchase.total).toBe(75000);
    expect((await prisma.batch.findMany({ where: { productId: product.id } })).map((b) => b.quantity).sort()).toEqual([1, 10]);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).purchasePrice)).toBe(7500);
  });

  it('takes the same product twice as two batches with their own expiry dates', async () => {
    const { user, supplier, product } = await fixtures();

    await createPurchase(user.id, {
      supplierId: supplier.id,
      items: [
        { productId: product.id, quantity: 3, unitPrice: 8000, expiryDate: isoDaysFromToday(100) },
        { productId: product.id, quantity: 4, unitPrice: 8000, expiryDate: isoDaysFromToday(400) },
      ],
    });

    expect(await prisma.batch.count({ where: { productId: product.id } })).toBe(2);
  });

  it('refuses stock that has already expired, naming the product, and saves nothing', async () => {
    const { user, supplier, product } = await fixtures();

    await expect(
      createPurchase(user.id, {
        supplierId: supplier.id,
        items: [{ productId: product.id, quantity: 3, unitPrice: 8000, expiryDate: isoDaysFromToday(-1) }],
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('دواء') });
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('accepts stock expiring today — it is still sellable today', async () => {
    const { user, supplier, product } = await fixtures();

    await createPurchase(user.id, {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 8000, expiryDate: isoDaysFromToday(0) }],
    });

    expect(await prisma.purchase.count()).toBe(1);
  });

  it('adds the total in whole minor units, with no floating-point drift', async () => {
    const { user, supplier, product } = await fixtures();

    const purchase = await createPurchase(user.id, {
      supplierId: supplier.id,
      items: [
        { productId: product.id, quantity: 3, unitPrice: 0.1 },
        { productId: product.id, quantity: 1, unitPrice: 0.2 },
      ],
    });

    expect(purchase.total).toBe(0.5);
  });
});
