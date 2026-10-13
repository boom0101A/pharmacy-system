import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../../services/sales.service.js';
import { createReturn } from '../../services/returns.service.js';

async function seedUser() {
  return prisma.user.create({
    data: { name: 'كاشير', username: `c-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
  });
}

describe('non-image uploads', () => {
  it('answer 400 with an Arabic message, not a 500, and leave no file behind', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-bad-'));
    process.env.UPLOADS_DIR = dir;
    vi.resetModules();
    try {
      const { prisma: freshPrisma } = await import('../../prisma.js');
      const product = await freshPrisma.product.create({ data: { name: 'صورة', salePrice: '1', purchasePrice: '1' } });
      const { saveProductImage } = await import('../../services/productImage.service.js');

      await expect(saveProductImage(product.id, Buffer.from('this is not an image'))).rejects.toMatchObject({ status: 400 });
      expect(await fs.readdir(path.join(dir, 'products')).catch(() => [])).toEqual([]);
    } finally {
      delete process.env.UPLOADS_DIR;
      vi.resetModules();
    }
  });
});

describe('idempotent checkout retried concurrently', () => {
  it('returns the one existing invoice to both requests instead of failing the second', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '10', purchasePrice: '5' } });
    await prisma.batch.create({ data: { productId: product.id, quantity: 10 } });
    const input = { items: [{ productId: product.id, quantity: 1 }], idempotencyKey: `key-${Math.random()}` };

    const [a, b] = await Promise.all([createSale(user.id, input), createSale(user.id, input)]);

    expect(a.id).toBe(b.id);
    expect(await prisma.sale.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });
});

describe('refund rounding across several partial returns', () => {
  it('never refunds more in total than the customer actually paid', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '1', purchasePrice: '0.5' } });
    const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 0 } });
    // 3 × 1.00 with a 1.00 discount → 2.00 paid; each single-unit refund rounds 0.666… up to 0.67.
    const sale = await prisma.sale.create({
      data: {
        userId: user.id,
        total: '2',
        discount: '1',
        items: { create: [{ productId: product.id, batchId: batch.id, quantity: 3, unitPrice: '1' }] },
      },
      include: { items: true },
    });

    let refunded = 0;
    for (let i = 0; i < 3; i++) {
      const r = await createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 1 }] });
      refunded += r.total;
    }

    expect(Math.round(refunded * 100)).toBeLessThanOrEqual(200);
  });
});

describe('concurrent returns on different lines of one invoice', () => {
  it('still cannot refund more in total than the invoice took in', async () => {
    const user = await seedUser();
    const lines = await Promise.all(
      [1, 2, 3].map(async (i) => {
        const p = await prisma.product.create({ data: { name: `د${i}`, salePrice: '1', purchasePrice: '0.5' } });
        const b = await prisma.batch.create({ data: { productId: p.id, quantity: 0 } });
        return { productId: p.id, batchId: b.id, quantity: 1, unitPrice: '1' };
      }),
    );
    // Subtotal 3.00, discount 1.00 → 2.00 paid; each line refunds 0.666… → 0.67.
    const sale = await prisma.sale.create({
      data: { userId: user.id, total: '2', discount: '1', items: { create: lines } },
      include: { items: true },
    });

    const results = await Promise.all(
      sale.items.map((item) => createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: item.id, quantity: 1 }] })),
    );

    const refunded = results.reduce((sum, r) => sum + Math.round(r.total * 100), 0);
    expect(refunded).toBeLessThanOrEqual(200);
  });
});
