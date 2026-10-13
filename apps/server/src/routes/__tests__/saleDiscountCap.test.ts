import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';
import { AppError } from '../../middleware/errors.js';
import { saleSchema } from '../sales.routes.js';

async function seed() {
  const user = await prisma.user.create({
    data: { name: 'كاشير', username: `c-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
  const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '50', purchasePrice: '20' } });
  const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });
  return { user, product, batch };
}

describe('sale discount cap', () => {
  it('rejects a discount larger than the subtotal and leaves stock untouched', async () => {
    const { user, product, batch } = await seed();

    await expect(
      createSale(user.id, { items: [{ productId: product.id, quantity: 1 }], discount: 100 }),
    ).rejects.toBeInstanceOf(AppError);

    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).quantity).toBe(5);
  });

  it('still accepts a discount equal to the subtotal', async () => {
    const { user, product } = await seed();
    const sale = await createSale(user.id, { items: [{ productId: product.id, quantity: 1 }], discount: 50 });
    expect(sale.total).toBe(0);
  });

  it('rejects an infinite discount at the schema', () => {
    expect(() => saleSchema.parse({ items: [{ productId: 1, quantity: 1 }], discount: Infinity })).toThrow();
  });
});
