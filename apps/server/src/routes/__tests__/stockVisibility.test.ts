import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { listProducts, productStats } from '../../services/products.service.js';

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function makeProduct(opts: { reorderLevel?: number } = {}) {
  return prisma.product.create({
    data: {
      name: `دواء ${Date.now()}-${Math.random()}`,
      salePrice: '10',
      purchasePrice: '5',
      reorderLevel: opts.reorderLevel ?? 10,
    },
  });
}

describe('stock status classification', () => {
  it('marks a product with zero total stock as "out" and nothing else', async () => {
    const product = await makeProduct();
    await prisma.batch.create({ data: { productId: product.id, quantity: 0 } });

    const [out, low, expiring] = await Promise.all([
      listProducts({ status: 'out' }),
      listProducts({ status: 'low' }),
      listProducts({ status: 'expiring' }),
    ]);
    expect(out.map((p) => p.id)).toContain(product.id);
    expect(low.map((p) => p.id)).not.toContain(product.id);
    expect(expiring.map((p) => p.id)).not.toContain(product.id);
  });

  it('marks a product as "low" only once stock is positive but at or below the reorder level', async () => {
    const product = await makeProduct({ reorderLevel: 5 });
    await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });

    const [low, out] = await Promise.all([
      listProducts({ status: 'low' }),
      listProducts({ status: 'out' }),
    ]);
    expect(low.map((p) => p.id)).toContain(product.id);
    expect(out.map((p) => p.id)).not.toContain(product.id);

    // Push it above the threshold and it should drop out of "low".
    await prisma.batch.updateMany({ where: { productId: product.id }, data: { quantity: 6 } });
    const lowAfter = await listProducts({ status: 'low' });
    expect(lowAfter.map((p) => p.id)).not.toContain(product.id);
  });

  it('marks a product as "expiring" only when its nearest expiry among in-stock batches is within the warning window', async () => {
    const product = await makeProduct();
    // One batch expires in 60 days (outside the window) and still has stock...
    await prisma.batch.create({
      data: { productId: product.id, quantity: 3, expiryDate: daysFromNow(60) },
    });
    let expiring = await listProducts({ status: 'expiring' });
    expect(expiring.map((p) => p.id)).not.toContain(product.id);

    // ...then a second batch expiring in 10 days (inside the window) is added.
    await prisma.batch.create({
      data: { productId: product.id, quantity: 2, expiryDate: daysFromNow(10) },
    });
    expiring = await listProducts({ status: 'expiring' });
    expect(expiring.map((p) => p.id)).toContain(product.id);
  });

  it('ignores a depleted batch expiry date even if it is the soonest one on record', async () => {
    const product = await makeProduct();
    // Depleted batch "expires" tomorrow, but has nothing left in it.
    await prisma.batch.create({
      data: { productId: product.id, quantity: 0, expiryDate: daysFromNow(1) },
    });
    // The only batch with real stock expires far in the future.
    await prisma.batch.create({
      data: { productId: product.id, quantity: 4, expiryDate: daysFromNow(200) },
    });

    const expiring = await listProducts({ status: 'expiring' });
    expect(expiring.map((p) => p.id)).not.toContain(product.id);

    const list = await listProducts({});
    const found = list.find((p) => p.id === product.id);
    expect(found?.nearestExpiry).not.toBeNull();
    // expiryDate is stored as a DATE column (no time component), so compare
    // calendar dates rather than exact timestamps.
    expect(new Date(found!.nearestExpiry!).toISOString().slice(0, 10)).toBe(
      daysFromNow(200).toISOString().slice(0, 10),
    );
  });

  it('keeps productStats counts consistent with listProducts filtering', async () => {
    const outProduct = await makeProduct();
    await prisma.batch.create({ data: { productId: outProduct.id, quantity: 0 } });

    const lowProduct = await makeProduct({ reorderLevel: 10 });
    await prisma.batch.create({ data: { productId: lowProduct.id, quantity: 5 } });

    const healthyProduct = await makeProduct({ reorderLevel: 5 });
    await prisma.batch.create({ data: { productId: healthyProduct.id, quantity: 50 } });

    const [stats, all, out, low] = await Promise.all([
      productStats(),
      listProducts({}),
      listProducts({ status: 'out' }),
      listProducts({ status: 'low' }),
    ]);

    expect(stats.total).toBe(all.length);
    expect(stats.out).toBe(out.length);
    expect(stats.low).toBe(low.length);
  });
});
