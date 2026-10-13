import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { findById } from '../products.service.js';

describe('findById', () => {
  it('returns one product with its live stock, regardless of catalogue size or name order', async () => {
    await prisma.product.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({ name: `أ-${i}`, salePrice: '1', purchasePrice: '1' })),
    });
    const target = await prisma.product.create({ data: { name: 'ي-آخر صنف', salePrice: '5', purchasePrice: '2' } });
    await prisma.batch.create({ data: { productId: target.id, quantity: 7 } });

    const p = await findById(target.id);

    expect(p?.name).toBe('ي-آخر صنف');
    expect(p?.stock).toBe(7);
  });

  it('is null for an unknown id', async () => {
    expect(await findById(999_999)).toBeNull();
  });
});
