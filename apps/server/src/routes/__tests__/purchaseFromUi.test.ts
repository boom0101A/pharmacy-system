import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';

/** Exactly the shapes the Purchases screen sends: a date input's "YYYY-MM-DD", or null when left empty. */
describe('purchase invoice as the Purchases screen sends it', () => {
  it.each([
    ['with batch number and expiry', 'B-1', '2027-03-31'],
    ['with nothing optional filled in', null, null],
  ])('saves %s', async (_label, batchNumber, expiryDate) => {
    const admin = await prisma.user.create({ data: { name: 'م', username: 'a', passwordHash: 'x', role: 'admin' } });
    const supplier = await prisma.supplier.create({ data: { name: 'مذخر' } });
    const product = await prisma.product.create({ data: { name: 'دواء', salePrice: '9000', purchasePrice: '8000' } });

    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    try {
      const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ userId: admin.id, role: 'admin' })}` },
        body: JSON.stringify({
          supplierId: supplier.id,
          items: [{ productId: product.id, quantity: 5, unitPrice: 8000, batchNumber, expiryDate }],
        }),
      });
      const body = await res.text();
      expect(res.status, body).toBe(201);
      expect(await prisma.purchase.count()).toBe(1);
      expect((await prisma.batch.findFirstOrThrow({ where: { productId: product.id } })).quantity).toBe(5);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
