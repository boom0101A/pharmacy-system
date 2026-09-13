import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';
import { AppError } from '../../middleware/errors.js';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function seedUser() {
  return prisma.user.create({
    data: { name: 'كاشير', username: `cashier-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
}

describe('expired-batch exclusion from FEFO sale selection', () => {
  it('draws from a valid batch instead of an already-expired one that expires sooner, even though FEFO would normally prefer the sooner expiry', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({
      data: { name: 'دواء منتهي جزئياً', salePrice: '10', purchasePrice: '5' },
    });
    const expired = await prisma.batch.create({
      data: { productId: product.id, quantity: 5, expiryDate: daysFromNow(-3) },
    });
    const valid = await prisma.batch.create({
      data: { productId: product.id, quantity: 5, expiryDate: daysFromNow(30) },
    });

    await createSale(user.id, { items: [{ productId: product.id, quantity: 3 }] });

    const expiredAfter = await prisma.batch.findUniqueOrThrow({ where: { id: expired.id } });
    const validAfter = await prisma.batch.findUniqueOrThrow({ where: { id: valid.id } });
    expect(expiredAfter.quantity).toBe(5); // untouched
    expect(validAfter.quantity).toBe(2); // 5 - 3
  });

  it('rejects the sale as out of stock when the only remaining quantity sits in an expired batch', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({
      data: { name: 'دواء منتهي بالكامل', salePrice: '10', purchasePrice: '5' },
    });
    await prisma.batch.create({
      data: { productId: product.id, quantity: 5, expiryDate: daysFromNow(-1) },
    });

    await expect(createSale(user.id, { items: [{ productId: product.id, quantity: 1 }] })).rejects.toBeInstanceOf(
      AppError,
    );

    const batch = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batch.quantity).toBe(5); // never touched
  });
});
