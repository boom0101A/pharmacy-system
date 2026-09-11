import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';
import { AppError } from '../../middleware/errors.js';

async function seedProductWithStock(quantity: number) {
  const user = await prisma.user.create({
    data: { name: 'كاشير', username: `cashier-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
  const product = await prisma.product.create({
    data: { name: 'دواء اختبار', salePrice: '10', purchasePrice: '5' },
  });
  await prisma.batch.create({ data: { productId: product.id, quantity } });
  return { user, product };
}

describe('sale race conditions', () => {
  it('never oversells the last unit when two sales race for it', async () => {
    const { user, product } = await seedProductWithStock(1);

    const attempt = () => createSale(user.id, { items: [{ productId: product.id, quantity: 1 }] });
    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AppError);

    const batch = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batch.quantity).toBe(0);

    const saleItemCount = await prisma.saleItem.count({ where: { productId: product.id } });
    expect(saleItemCount).toBe(1);
  });

  it('lets two sales succeed when there is enough stock for both', async () => {
    const { user, product } = await seedProductWithStock(5);

    const attempt = () => createSale(user.id, { items: [{ productId: product.id, quantity: 2 }] });
    const results = await Promise.allSettled([attempt(), attempt()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

    const batch = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batch.quantity).toBe(1); // 5 - 2 - 2
  });
});
