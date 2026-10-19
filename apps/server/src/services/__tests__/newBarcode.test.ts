import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { internalBarcode } from '../../lib/barcode.js';
import { createProduct, newUniqueBarcode } from '../products.service.js';

const product = (name: string, barcode: string | null) =>
  ({ name, barcode, salePrice: 1, purchasePrice: 1 }) as Parameters<typeof createProduct>[0];

describe('newUniqueBarcode', () => {
  it('skips a code some product already has', async () => {
    const values = [0.1, 0.1, 0.7];
    const random = () => values.shift() ?? 0.5;
    const taken = internalBarcode(() => 0.1);
    await createProduct(product('موجود', taken));

    const code = await newUniqueBarcode(random);

    expect(code).not.toBe(taken);
    expect(code).toBe(internalBarcode(() => 0.7));
  });
});

describe('saving a barcode another product already uses', () => {
  it('names that product instead of a generic error', async () => {
    await createProduct(product('بنادول', '200000000017'));

    await expect(createProduct(product('جديد', '200000000017'))).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('بنادول'),
    });
  });

  it('lets a product keep its own barcode when it is edited', async () => {
    const { updateProduct } = await import('../products.service.js');
    const p = await createProduct(product('ذاته', '200000000024'));

    await expect(updateProduct(p.id, product('ذاته معدّل', '200000000024'))).resolves.toBeTruthy();
  });
});

describe('GET /api/products/barcode/new', () => {
  async function call(role: 'admin' | 'cashier') {
    const user = await prisma.user.create({ data: { name: 'م', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    try {
      return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/products/barcode/new`, {
        headers: { Authorization: `Bearer ${signToken({ userId: user.id, role })}` },
      });
    } finally {
      server.close();
    }
  }

  it('hands the pharmacist a fresh 12-digit code', async () => {
    const res = await call('admin');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { barcode: string }).barcode).toMatch(/^20\d{10}$/);
  });

  it('is not for the cashier', async () => {
    expect((await call('cashier')).status).toBe(403);
  });
});
