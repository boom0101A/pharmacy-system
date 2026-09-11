import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createReturn } from '../../services/returns.service.js';

async function seedDiscountedSale() {
  const user = await prisma.user.create({
    data: { name: 'كاشير', username: `cashier-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
  const productA = await prisma.product.create({
    data: { name: 'دواء أ', salePrice: '100', purchasePrice: '50' },
  });
  const productB = await prisma.product.create({
    data: { name: 'دواء ب', salePrice: '100', purchasePrice: '50' },
  });
  const batchA = await prisma.batch.create({ data: { productId: productA.id, quantity: 0 } });
  const batchB = await prisma.batch.create({ data: { productId: productB.id, quantity: 0 } });

  // Subtotal 200, a 20 discount (10%) applied at the invoice level.
  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      total: '180',
      discount: '20',
      items: {
        create: [
          { productId: productA.id, batchId: batchA.id, quantity: 1, unitPrice: '100' },
          { productId: productB.id, batchId: batchB.id, quantity: 1, unitPrice: '100' },
        ],
      },
    },
    include: { items: true },
  });

  return { user, sale, itemA: sale.items[0], itemB: sale.items[1] };
}

describe('return refund respects the sale discount', () => {
  it('refunds the discounted share of the price, not the full list price', async () => {
    const { user, sale, itemA } = await seedDiscountedSale();

    // paidRatio = (200 - 20) / 200 = 0.9 → refund for 1 unit at 100 is 90, not 100.
    const result = await createReturn(user.id, {
      saleId: sale.id,
      items: [{ saleItemId: itemA.id, quantity: 1 }],
    });

    expect(result.total).toBe(90);
  });

  it('applies the same discount ratio proportionally across a partial multi-line return', async () => {
    const { user, sale, itemA, itemB } = await seedDiscountedSale();

    const result = await createReturn(user.id, {
      saleId: sale.id,
      items: [
        { saleItemId: itemA.id, quantity: 1 },
        { saleItemId: itemB.id, quantity: 1 },
      ],
    });

    // Both lines returned in full: 200 list price * 0.9 = 180, matching the
    // full discounted total of the invoice.
    expect(result.total).toBe(180);
  });

  it('refunds the full price with no discount applied when the sale had none', async () => {
    const user = await prisma.user.create({
      data: { name: 'كاشير', username: `cashier-${Date.now()}-nodisc`, passwordHash: 'x', role: 'cashier' },
    });
    const product = await prisma.product.create({
      data: { name: 'دواء ج', salePrice: '50', purchasePrice: '25' },
    });
    const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 0 } });
    const sale = await prisma.sale.create({
      data: {
        userId: user.id,
        total: '50',
        items: { create: { productId: product.id, batchId: batch.id, quantity: 1, unitPrice: '50' } },
      },
      include: { items: true },
    });

    const result = await createReturn(user.id, {
      saleId: sale.id,
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
    });

    expect(result.total).toBe(50);
  });
});
