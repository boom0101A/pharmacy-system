import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';

describe('sale idempotency', () => {
  it('a retried checkout with the same key returns the original invoice instead of creating a second one', async () => {
    const user = await prisma.user.create({
      data: { name: 'كاشير', username: `cashier-${Date.now()}`, passwordHash: 'x', role: 'cashier' },
    });
    const product = await prisma.product.create({
      data: { name: 'دواء اختبار', salePrice: '10', purchasePrice: '5' },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 10 } });

    const key = 'retry-key-fixed';
    const input = { items: [{ productId: product.id, quantity: 1 }], idempotencyKey: key };

    // A real retry (network drop before the response arrived) is sequential
    // from the client's point of view, not concurrent — that's the case this
    // guards, so the test mirrors it rather than racing two calls at once.
    const first = await createSale(user.id, input);
    const second = await createSale(user.id, input);

    expect(second.id).toBe(first.id);

    const salesCount = await prisma.sale.count();
    expect(salesCount).toBe(1);

    const batch = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batch.quantity).toBe(9); // deducted once, not twice
  });

  it('two truly concurrent retries with the same key still produce only one sale', async () => {
    const user = await prisma.user.create({
      data: { name: 'كاشير', username: `cashier-${Date.now()}-2`, passwordHash: 'x', role: 'cashier' },
    });
    const product = await prisma.product.create({
      data: { name: 'دواء اختبار ٢', salePrice: '10', purchasePrice: '5' },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 10 } });

    const key = 'retry-key-concurrent';
    const input = { items: [{ productId: product.id, quantity: 1 }], idempotencyKey: key };

    const results = await Promise.allSettled([createSale(user.id, input), createSale(user.id, input)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof createSale>>>[];

    // Either both resolve to the same sale, or one hits the unique constraint
    // on idempotency_key and is rejected — both outcomes are safe; two
    // distinct sale rows is the only unacceptable one.
    const salesCount = await prisma.sale.count();
    expect(salesCount).toBe(1);
    if (fulfilled.length === 2) {
      expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);
    }
  });
});
