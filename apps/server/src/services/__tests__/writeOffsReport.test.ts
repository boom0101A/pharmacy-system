import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { writeOffBatch } from '../batches.service.js';
import { getWriteOffsReport } from '../reports.service.js';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

describe('getWriteOffsReport', () => {
  it('lists write-offs with product name, quantity, and the acting user, most recent first', async () => {
    const user = await prisma.user.create({
      data: { name: 'صيدلانية الجرد', username: `stocktaker-${Date.now()}`, passwordHash: 'x', role: 'pharmacist' },
    });
    const product = await prisma.product.create({
      data: { name: 'شراب سعال منتهي', salePrice: '10', purchasePrice: '5' },
    });
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 9, expiryDate: daysFromNow(-10) },
    });

    await writeOffBatch(batch.id, user.id);

    const rows = await getWriteOffsReport();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productName: 'شراب سعال منتهي',
      quantity: 9,
      userName: 'صيدلانية الجرد',
    });
  });

  it('returns an empty list when nothing has ever been written off', async () => {
    const rows = await getWriteOffsReport();
    expect(rows).toEqual([]);
  });
});
