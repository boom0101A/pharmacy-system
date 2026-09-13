import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { productAlternatives } from '../../services/products.service.js';

describe('productAlternatives active-ingredient matching', () => {
  it('finds an alternative whose active ingredient differs only by letter case', async () => {
    const outOfStock = await prisma.product.create({
      data: { name: 'دواء أ', salePrice: '10', purchasePrice: '5', activeIngredient: 'Paracetamol' },
    });
    await prisma.batch.create({ data: { productId: outOfStock.id, quantity: 0 } });

    const alternative = await prisma.product.create({
      data: { name: 'دواء ب', salePrice: '12', purchasePrice: '6', activeIngredient: 'paracetamol' },
    });
    await prisma.batch.create({ data: { productId: alternative.id, quantity: 20 } });

    const results = await productAlternatives(outOfStock.id);

    expect(results.map((r) => r.id)).toContain(alternative.id);
  });
});
