import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createReturn } from '../../services/returns.service.js';
import { AppError } from '../../middleware/errors.js';

async function seedSoldSale(quantitySold: number) {
  const user = await prisma.user.create({
    data: { name: 'كاشير', username: `cashier-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
  const product = await prisma.product.create({
    data: { name: 'دواء اختبار', salePrice: '10', purchasePrice: '5' },
  });
  const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 0 } });
  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      total: (10 * quantitySold).toString(),
      items: {
        create: { productId: product.id, batchId: batch.id, quantity: quantitySold, unitPrice: '10' },
      },
    },
    include: { items: true },
  });
  return { user, sale, saleItem: sale.items[0], batchId: batch.id };
}

describe('return race conditions', () => {
  it('never refunds more than was actually sold when two returns race for the same line', async () => {
    const { user, saleItem } = await seedSoldSale(2);

    const attempt = () =>
      createReturn(user.id, { saleId: saleItem.saleId, items: [{ saleItemId: saleItem.id, quantity: 2 }] });
    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AppError);

    const totalReturned = await prisma.returnItem.aggregate({
      where: { saleItemId: saleItem.id },
      _sum: { quantity: true },
    });
    expect(totalReturned._sum.quantity).toBe(2); // not 4
  });

  it('rejects a return for more than remains after a partial return already happened', async () => {
    const { user, saleItem } = await seedSoldSale(3);

    await createReturn(user.id, { saleId: saleItem.saleId, items: [{ saleItemId: saleItem.id, quantity: 2 }] });

    await expect(
      createReturn(user.id, { saleId: saleItem.saleId, items: [{ saleItemId: saleItem.id, quantity: 2 }] }),
    ).rejects.toBeInstanceOf(AppError);

    const totalReturned = await prisma.returnItem.aggregate({
      where: { saleItemId: saleItem.id },
      _sum: { quantity: true },
    });
    expect(totalReturned._sum.quantity).toBe(2); // the rejected second attempt added nothing
  });

  it('returned stock goes back to the exact batch it was sold from', async () => {
    const { user, saleItem, batchId } = await seedSoldSale(2);

    await createReturn(user.id, { saleId: saleItem.saleId, items: [{ saleItemId: saleItem.id, quantity: 2 }] });

    const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.quantity).toBe(2);
  });
});
