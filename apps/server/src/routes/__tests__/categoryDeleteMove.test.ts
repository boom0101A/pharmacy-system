import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/categories`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function del(id: number, query = '', role: 'pharmacist' | 'cashier' = 'pharmacist') {
  const user = await prisma.user.create({ data: { name: 'م', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
  return fetch(`${base}/${id}${query}`, { method: 'DELETE', headers: { Authorization: `Bearer ${signToken({ userId: user.id, role })}` } });
}

async function setup() {
  const from = await prisma.category.create({ data: { name: `مسكنات-${Math.random()}` } });
  const to = await prisma.category.create({ data: { name: `آلام-${Math.random()}` } });
  const a = await prisma.product.create({ data: { name: 'أ', salePrice: '1', purchasePrice: '1', categoryId: from.id } });
  const archived = await prisma.product.create({
    data: { name: 'ب', salePrice: '1', purchasePrice: '1', categoryId: from.id, archivedAt: new Date() },
  });
  return { from, to, ids: [a.id, archived.id] };
}

const categoriesOf = async (ids: number[]) =>
  (await prisma.product.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })).map((p) => p.categoryId);

describe('deleting a category that still has medicines', () => {
  it('moves all of them — archived ones included — to the chosen category', async () => {
    const { from, to, ids } = await setup();

    const res = await del(from.id, `?moveTo=${to.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ moved: 2 });
    expect(await categoriesOf(ids)).toEqual([to.id, to.id]);
    expect(await prisma.category.findUnique({ where: { id: from.id } })).toBeNull();
  });

  it('without a target, leaves them uncategorised and keeps every medicine', async () => {
    const { from, ids } = await setup();

    const res = await del(from.id);

    expect(res.status).toBe(200);
    expect(await categoriesOf(ids)).toEqual([null, null]);
  });

  it.each([
    ['itself', (s: Awaited<ReturnType<typeof setup>>) => s.from.id],
    ['a category that does not exist', () => 999_999],
  ])('refuses to move them to %s and changes nothing', async (_label, target) => {
    const s = await setup();

    const res = await del(s.from.id, `?moveTo=${target(s)}`);

    expect(res.status).toBe(400);
    expect(await categoriesOf(s.ids)).toEqual([s.from.id, s.from.id]);
    expect(await prisma.category.findUnique({ where: { id: s.from.id } })).not.toBeNull();
  });

  it('is not for the cashier', async () => {
    const { from } = await setup();
    expect((await del(from.id, '', 'cashier')).status).toBe(403);
  });
});
