import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createReturn } from '../../services/returns.service.js';
import { AppError } from '../../middleware/errors.js';

async function seedSale(opts: { quantity: number; total: string; discount: string }) {
  const user = await prisma.user.create({
    data: { name: 'كاشير', username: `c-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
  const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '50', purchasePrice: '20' } });
  const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 0 } });
  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      total: opts.total,
      discount: opts.discount,
      items: { create: [{ productId: product.id, batchId: batch.id, quantity: opts.quantity, unitPrice: '50' }] },
    },
    include: { items: true },
  });
  return { user, sale, item: sale.items[0], batch };
}

describe('return integrity', () => {
  it('rejects the same sale line listed twice in one return, instead of refunding more than was sold', async () => {
    const { user, sale, item, batch } = await seedSale({ quantity: 2, total: '100', discount: '0' });

    await expect(
      createReturn(user.id, {
        saleId: sale.id,
        items: [
          { saleItemId: item.id, quantity: 2 },
          { saleItemId: item.id, quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).quantity).toBe(0);
    expect(await prisma.return.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it('never produces a negative refund for a legacy sale whose discount exceeded its subtotal', async () => {
    const { user, sale, item } = await seedSale({ quantity: 1, total: '0', discount: '100' });

    const result = await createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: item.id, quantity: 1 }] });

    expect(result.total).toBe(0);
  });
});
