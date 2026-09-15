import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { writeOffBatch } from '../batches.service.js';
import { AppError } from '../../middleware/errors.js';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function seedUser() {
  return prisma.user.create({
    data: { name: 'صيدلاني', username: `pharmacist-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'pharmacist' },
  });
}

async function seedProduct() {
  return prisma.product.create({
    data: { name: 'دواء منتهي', salePrice: '10', purchasePrice: '5' },
  });
}

describe('writeOffBatch', () => {
  it('zeroes an expired batch\'s quantity and logs the write-off with the acting user and original quantity', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 7, expiryDate: daysFromNow(-3) },
    });

    await writeOffBatch(batch.id, user.id);

    const after = await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(after.quantity).toBe(0);

    const writeOff = await prisma.batchWriteOff.findFirstOrThrow({ where: { batchId: batch.id } });
    expect(writeOff.quantity).toBe(7);
    expect(writeOff.userId).toBe(user.id);
  });

  it('rejects a batch that has not actually expired yet', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 5, expiryDate: daysFromNow(30) },
    });

    await expect(writeOffBatch(batch.id, user.id)).rejects.toBeInstanceOf(AppError);

    const after = await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(after.quantity).toBe(5);
  });

  it('rejects a batch with no expiry date at all', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 5, expiryDate: null },
    });

    await expect(writeOffBatch(batch.id, user.id)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a batch whose quantity is already zero', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 0, expiryDate: daysFromNow(-1) },
    });

    await expect(writeOffBatch(batch.id, user.id)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a non-existent batch id', async () => {
    const user = await seedUser();
    await expect(writeOffBatch(999999, user.id)).rejects.toBeInstanceOf(AppError);
  });
});
