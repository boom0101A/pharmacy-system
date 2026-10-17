import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { resolveRange } from '../../lib/dateRange.js';
import { createSale } from '../sales.service.js';
import { createReturn } from '../returns.service.js';
import { getSoldProducts } from '../reports.service.js';

async function seedUser() {
  return prisma.user.create({
    data: { name: 'مدير', username: `a-${Math.random()}`, passwordHash: 'x', role: 'admin' },
  });
}

async function stocked(name: string, extra: object = {}) {
  const product = await prisma.product.create({ data: { name, salePrice: '1000', purchasePrice: '500', ...extra } });
  await prisma.batch.create({ data: { productId: product.id, quantity: 50 } });
  return product;
}

const wide = () => ({ start: new Date(Date.now() - 86_400_000), end: new Date(Date.now() + 86_400_000) });

describe('sold products for a period', () => {
  it('lists every product sold, not just the top ten', async () => {
    const user = await seedUser();
    for (let i = 1; i <= 12; i++) {
      const p = await stocked(`دواء ${i}`);
      await createSale(user.id, { items: [{ productId: p.id, quantity: 1 }] });
    }

    const { start, end } = wide();
    expect(await getSoldProducts(start, end)).toHaveLength(12);
  });

  it('counts packages and strips separately', async () => {
    const user = await seedUser();
    const p = await stocked('أقراص', { unitsPerPackage: 4, subUnitName: 'شريط', subUnitPrice: '300' });

    await createSale(user.id, {
      items: [
        { productId: p.id, quantity: 2 },
        { productId: p.id, quantity: 3, isSubUnit: true },
      ],
    });

    const { start, end } = wide();
    expect(await getSoldProducts(start, end)).toEqual([
      { productId: p.id, productName: 'أقراص', packages: 2, subUnits: 3, subUnitName: 'شريط', revenue: 2900 },
    ]);
  });

  it('takes returned quantities back out', async () => {
    const user = await seedUser();
    const p = await stocked('مرتجع جزئياً');
    const sale = await createSale(user.id, { items: [{ productId: p.id, quantity: 5 }] });
    await createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 2 }] });

    const { start, end } = wide();
    const [row] = await getSoldProducts(start, end);
    expect(row).toMatchObject({ packages: 3, revenue: 3000 });
  });

  it('leaves out a product returned in full', async () => {
    const user = await seedUser();
    const p = await stocked('مرتجع كلياً');
    const sale = await createSale(user.id, { items: [{ productId: p.id, quantity: 1 }] });
    await createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 1 }] });

    const { start, end } = wide();
    expect(await getSoldProducts(start, end)).toEqual([]);
  });

  it('respects the chosen dates in Baghdad days — a 1 a.m. sale belongs to that day, not the one before', async () => {
    const user = await seedUser();
    const p = await stocked('ليلي');
    const sale = await createSale(user.id, { items: [{ productId: p.id, quantity: 1 }] });
    // 01:00 Baghdad on 10 March = 22:00 UTC on 9 March.
    await prisma.sale.update({ where: { id: sale.id }, data: { date: new Date('2026-03-09T22:00:00Z') } });

    const onTenth = resolveRange(new Date('2026-03-10'), new Date('2026-03-10'));
    const onNinth = resolveRange(new Date('2026-03-09'), new Date('2026-03-09'));
    expect(await getSoldProducts(onTenth.start, onTenth.end)).toHaveLength(1);
    expect(await getSoldProducts(onNinth.start, onNinth.end)).toHaveLength(0);
  });
});
