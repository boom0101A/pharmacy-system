import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { createSale } from '../sales.service.js';
import { createReturn } from '../returns.service.js';
import { createPurchase } from '../purchases.service.js';
import { getSoldProducts } from '../reports.service.js';
import { lowStockList } from '../dashboard.service.js';
import * as products from '../products.service.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/products`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function userAs(role: 'admin' | 'pharmacist' | 'cashier') {
  return prisma.user.create({ data: { name: 'م', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
}

async function call(role: 'admin' | 'pharmacist' | 'cashier', method: string, path: string) {
  const user = await userAs(role);
  return fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${signToken({ userId: user.id, role })}` } });
}

/** A product with two sold units and a few left on the shelf. */
async function soldProduct(extra: object = {}) {
  const seller = await userAs('cashier');
  const product = await prisma.product.create({
    data: { name: 'بنادول', barcode: '200000000111', salePrice: '1000', purchasePrice: '500', reorderLevel: 10, activeIngredient: 'باراسيتامول', ...extra },
  });
  await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });
  const sale = await createSale(seller.id, { items: [{ productId: product.id, quantity: 2 }] });
  return { product, sale, seller };
}

describe('deleting a product', () => {
  it('still removes for good a product with no invoices at all', async () => {
    const p = await prisma.product.create({ data: { name: 'جديد', salePrice: '1', purchasePrice: '1' } });

    const res = await call('pharmacist', 'DELETE', `/${p.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ archived: false });
    expect(await prisma.product.findUnique({ where: { id: p.id } })).toBeNull();
  });

  it('archives a product that was sold, leaving its old invoice untouched', async () => {
    const { product, sale } = await soldProduct();

    const res = await call('pharmacist', 'DELETE', `/${product.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ archived: true });
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.archivedAt).not.toBeNull();
    const invoice = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: true } });
    expect(invoice.items).toHaveLength(1);
    expect(Number(invoice.total)).toBe(2000);
  });

  it('is not for the cashier', async () => {
    const { product } = await soldProduct();
    expect((await call('cashier', 'DELETE', `/${product.id}`)).status).toBe(403);
  });
});

describe('an archived product', () => {
  async function archived() {
    const ctx = await soldProduct();
    await products.archiveOrDeleteProduct(ctx.product.id);
    return ctx;
  }

  it('is gone from the catalogue, the scanner, the counts, alternatives and low stock', async () => {
    const { product } = await archived();
    const sibling = await prisma.product.create({ data: { name: 'بديل', salePrice: '1', purchasePrice: '1', activeIngredient: 'باراسيتامول' } });
    await prisma.batch.create({ data: { productId: sibling.id, quantity: 3 } });

    expect((await products.listProducts({})).map((p) => p.id)).toEqual([sibling.id]);
    expect(await products.findByBarcode('200000000111')).toBeNull();
    expect((await products.productStats()).total).toBe(1);
    expect((await products.productAlternatives(sibling.id)).map((a) => a.id)).not.toContain(product.id);
    expect((await lowStockList(10)).map((r) => r.id)).not.toContain(product.id);
  });

  it('still shows in the history reports', async () => {
    const { product } = await archived();
    const rows = await getSoldProducts(new Date(Date.now() - 86_400_000), new Date(Date.now() + 86_400_000));
    expect(rows.map((r) => r.productId)).toContain(product.id);
  });

  it('frees its barcode so the medicine can be added again', async () => {
    await archived();
    await expect(
      products.createProduct({ name: 'بنادول جديد', barcode: '200000000111', salePrice: 1, purchasePrice: 1 } as Parameters<typeof products.createProduct>[0]),
    ).resolves.toBeTruthy();
  });

  it('cannot be sold or bought until restored', async () => {
    const { product, seller } = await archived();
    const supplier = await prisma.supplier.create({ data: { name: 'مذخر' } });

    await expect(createSale(seller.id, { items: [{ productId: product.id, quantity: 1 }] })).rejects.toMatchObject({
      message: expect.stringContaining('مؤرشف'),
    });
    await expect(
      createPurchase(seller.id, { supplierId: supplier.id, items: [{ productId: product.id, quantity: 1, unitPrice: 1 }] }),
    ).rejects.toMatchObject({ message: expect.stringContaining('مؤرشف') });
  });

  it('can still be returned from an old invoice', async () => {
    const { sale, seller } = await archived();
    await expect(
      createReturn(seller.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 1 }] }),
    ).resolves.toBeTruthy();
  });

  it('is listed under the archived filter and comes back when restored', async () => {
    const { product } = await archived();
    expect((await products.listProducts({ status: 'archived' })).map((p) => p.id)).toEqual([product.id]);

    const res = await call('pharmacist', 'POST', `/${product.id}/restore`);

    expect(res.status).toBe(200);
    expect((await products.listProducts({})).map((p) => p.id)).toContain(product.id);
  });
});
