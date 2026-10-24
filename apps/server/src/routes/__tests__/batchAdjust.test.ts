import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, toNumber } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/batches`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

type Role = 'admin' | 'pharmacist' | 'cashier';

async function userOf(role: Role) {
  return prisma.user.create({ data: { name: 'الصيدلي أحمد', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
}

async function adjust(batchId: number, body: Record<string, unknown>, role: Role = 'pharmacist') {
  const user = await userOf(role);
  return fetch(`${base}/${batchId}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ userId: user.id, role })}` },
    body: JSON.stringify(body),
  });
}

async function product(opts: { archived?: boolean } = {}) {
  return prisma.product.create({
    data: { name: 'بنادول', salePrice: '1000', purchasePrice: '500', archivedAt: opts.archived ? new Date() : null },
  });
}

/** A purchase invoice whose first line was typed as 500 instead of 50. */
async function invoiceWithTypo() {
  const p = await product();
  const other = await product();
  const supplier = await prisma.supplier.create({ data: { name: 'مذخر النور' } });
  const user = await userOf('pharmacist');
  const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 500, purchasePrice: '500' } });
  const otherBatch = await prisma.batch.create({ data: { productId: other.id, quantity: 10, purchasePrice: '250' } });
  const purchase = await prisma.purchase.create({
    data: {
      supplierId: supplier.id,
      userId: user.id,
      total: '252500', // 500 × 500 + 10 × 250
      status: 'received',
      items: {
        create: [
          { productId: p.id, batchId: batch.id, quantity: 500, unitPrice: '500' },
          { productId: other.id, batchId: otherBatch.id, quantity: 10, unitPrice: '250' },
        ],
      },
    },
    include: { items: true },
  });
  return { batch, purchase, line: purchase.items.find((i) => i.batchId === batch.id)! };
}

describe('POST /api/batches/:id/adjust — correcting a quantity typed in wrong', () => {
  it('sets the new quantity and keeps a permanent record of who, from what, to what and why', async () => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 48 } });

    const res = await adjust(batch.id, { quantity: 5, expectedQuantity: 48, reason: 'خطأ إدخال' });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { quantity: number }).quantity).toBe(5);
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).quantity).toBe(5);
    const log = await prisma.stockAdjustment.findFirstOrThrow({ where: { batchId: batch.id } });
    expect(log).toMatchObject({ oldQuantity: 48, newQuantity: 5, reason: 'خطأ إدخال', purchaseItemId: null });
  });

  it('corrects the purchase invoice line and its total by the same difference', async () => {
    const { batch, purchase, line } = await invoiceWithTypo();

    const res = await adjust(batch.id, { quantity: 50, expectedQuantity: 500, reason: 'خطأ إدخال' });

    expect(res.status).toBe(200);
    expect((await prisma.purchaseItem.findUniqueOrThrow({ where: { id: line.id } })).quantity).toBe(50);
    const after = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(toNumber(after.total)).toBe(27500); // 50 × 500 + 10 × 250
    const log = await prisma.stockAdjustment.findFirstOrThrow({ where: { batchId: batch.id } });
    expect(log.purchaseItemId).toBe(line.id);
  });

  it('keeps what was already sold when correcting an invoice batch', async () => {
    const { batch, line } = await invoiceWithTypo();
    // 20 sold since: 480 left on the batch, the invoice still says 500.
    await prisma.batch.update({ where: { id: batch.id }, data: { quantity: 480 } });

    await adjust(batch.id, { quantity: 30, expectedQuantity: 480, reason: 'خطأ إدخال' });

    // Really received 50: 30 left + the 20 sold.
    expect((await prisma.purchaseItem.findUniqueOrThrow({ where: { id: line.id } })).quantity).toBe(50);
  });

  it('refuses when the quantity changed since the form opened (a sale on another till), changing nothing', async () => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 47 } });

    const res = await adjust(batch.id, { quantity: 5, expectedQuantity: 48, reason: 'خطأ إدخال' });

    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(/تغيّرت/);
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).quantity).toBe(47);
    expect(await prisma.stockAdjustment.count()).toBe(0);
  });

  it.each([
    ['no reason', { quantity: 5, expectedQuantity: 48, reason: '   ' }],
    ['a negative quantity', { quantity: -1, expectedQuantity: 48, reason: 'خطأ إدخال' }],
    ['a fractional quantity', { quantity: 2.5, expectedQuantity: 48, reason: 'خطأ إدخال' }],
    ['the same quantity', { quantity: 48, expectedQuantity: 48, reason: 'خطأ إدخال' }],
  ])('refuses %s', async (_label, body) => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 48 } });

    const res = await adjust(batch.id, body);

    expect(res.status).toBe(400);
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).quantity).toBe(48);
  });

  it('allows a batch already sold from — the case delete refuses', async () => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 9 } });
    const cashier = await userOf('cashier');
    await prisma.sale.create({
      data: {
        userId: cashier.id,
        total: '1000',
        items: { create: [{ productId: p.id, batchId: batch.id, quantity: 1, unitPrice: '1000' }] },
      },
    });

    const res = await adjust(batch.id, { quantity: 4, expectedQuantity: 9, reason: 'جرد' });

    expect(res.status).toBe(200);
  });

  it('is closed to the cashier', async () => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 48 } });

    const res = await adjust(batch.id, { quantity: 5, expectedQuantity: 48, reason: 'خطأ إدخال' }, 'cashier');

    expect(res.status).toBe(403);
  });

  it('refuses a batch of an archived product', async () => {
    const p = await product({ archived: true });
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 48 } });

    const res = await adjust(batch.id, { quantity: 5, expectedQuantity: 48, reason: 'خطأ إدخال' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/batches — which invoice a batch came from', () => {
  it('names the purchase invoice for an invoice batch and null for a hand-received one', async () => {
    const { batch, purchase } = await invoiceWithTypo();
    const manual = await prisma.batch.create({ data: { productId: batch.productId, quantity: 3 } });
    const admin = await userOf('admin');

    const res = await fetch(`${base}?productId=${batch.productId}`, {
      headers: { Authorization: `Bearer ${signToken({ userId: admin.id, role: 'admin' })}` },
    });

    const rows = (await res.json()) as Array<{ id: number; purchaseId: number | null }>;
    expect(rows.find((r) => r.id === batch.id)?.purchaseId).toBe(purchase.id);
    expect(rows.find((r) => r.id === manual.id)?.purchaseId).toBeNull();
  });
});

describe('GET /api/batches/adjustments — the correction history', () => {
  it('lists a product’s corrections, newest first, with who made them', async () => {
    const p = await product();
    const batch = await prisma.batch.create({ data: { productId: p.id, quantity: 48 } });
    await adjust(batch.id, { quantity: 40, expectedQuantity: 48, reason: 'جرد' });
    await adjust(batch.id, { quantity: 5, expectedQuantity: 40, reason: 'خطأ إدخال' });
    const admin = await userOf('admin');

    const res = await fetch(`${base}/adjustments?productId=${p.id}`, {
      headers: { Authorization: `Bearer ${signToken({ userId: admin.id, role: 'admin' })}` },
    });

    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ batchId: batch.id, oldQuantity: 40, newQuantity: 5, reason: 'خطأ إدخال', userName: 'الصيدلي أحمد' });
    expect(rows[1]).toMatchObject({ oldQuantity: 48, newQuantity: 40 });
  });
});
