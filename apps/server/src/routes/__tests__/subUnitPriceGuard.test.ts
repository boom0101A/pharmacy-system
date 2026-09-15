import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';
import { AppError } from '../../middleware/errors.js';

async function seedUser() {
  return prisma.user.create({
    data: { name: 'كاشير', username: `cashier-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
}

describe('sub-unit sale defense against a missing subUnitPrice', () => {
  it('rejects a sub-unit sale instead of silently charging the full package price, when the product predates the sub-unit price requirement', async () => {
    // productSchema.refine() now requires unitsPerPackage/subUnitName/subUnitPrice
    // together on every *new* write — but existing rows written before that
    // fix can still have unitsPerPackage set with subUnitPrice left null.
    const user = await seedUser();
    const product = await prisma.product.create({
      data: {
        name: 'دواء بلا سعر وحدة فرعية',
        salePrice: '1000',
        purchasePrice: '500',
        unitsPerPackage: 10,
        subUnitName: 'حبة',
        subUnitPrice: null,
      },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });

    await expect(
      createSale(user.id, { items: [{ productId: product.id, quantity: 1, isSubUnit: true }] }),
    ).rejects.toBeInstanceOf(AppError);

    const batch = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batch.quantity).toBe(5); // the sale never went through
  });
});
