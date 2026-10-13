import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { createSale } from '../sales.service.js';
import { createReturn } from '../returns.service.js';
import { getProfitReport, getRevenueByCategory, getTopProducts } from '../reports.service.js';

const range = () => ({ start: new Date(Date.now() - 86_400_000), end: new Date(Date.now() + 86_400_000) });

async function seedUser() {
  return prisma.user.create({
    data: { name: 'مدير', username: `a-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'admin' },
  });
}

function totalCost(points: { cost: number }[]) {
  return points.reduce((sum, p) => sum + p.cost, 0);
}

describe('profit report accuracy', () => {
  it('costs a sub-unit sale at its share of the package, not the whole package', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({
      data: {
        name: 'شرائط',
        salePrice: '100',
        purchasePrice: '50',
        unitsPerPackage: 10,
        subUnitName: 'شريط',
        subUnitPrice: '12',
      },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 1, purchasePrice: '50' } });

    await createSale(user.id, { items: [{ productId: product.id, quantity: 1, isSubUnit: true }] });

    const { start, end } = range();
    expect(totalCost(await getProfitReport(start, end))).toBe(5);
  });

  it('snapshots the package size on the sale line', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({
      data: { name: 'شرائط ٢', salePrice: '100', purchasePrice: '50', unitsPerPackage: 4, subUnitName: 'شريط', subUnitPrice: '30' },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 1 } });

    const sale = await createSale(user.id, { items: [{ productId: product.id, quantity: 1, isSubUnit: true }] });

    const line = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(line.subUnitsPerPackage).toBe(4);
  });

  it('removes the cost of returned goods, so a sale returned in full nets to zero profit', async () => {
    const user = await seedUser();
    const product = await prisma.product.create({ data: { name: 'مرتجع', salePrice: '10', purchasePrice: '6' } });
    await prisma.batch.create({ data: { productId: product.id, quantity: 1, purchasePrice: '6' } });

    const sale = await createSale(user.id, { items: [{ productId: product.id, quantity: 1 }] });
    await createReturn(user.id, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, quantity: 1 }] });

    const { start, end } = range();
    const points = await getProfitReport(start, end);
    expect(points.reduce((sum, p) => sum + p.profit, 0)).toBe(0);
  });
});

describe('top products / by category ordering', () => {
  async function seedTwoSellers() {
    const user = await seedUser();
    const cheap = await prisma.product.create({ data: { name: 'رخيص', salePrice: '9', purchasePrice: '1' } });
    const pricey = await prisma.product.create({ data: { name: 'غالي', salePrice: '1500', purchasePrice: '1' } });
    await prisma.batch.create({ data: { productId: cheap.id, quantity: 5 } });
    await prisma.batch.create({ data: { productId: pricey.id, quantity: 5 } });
    await createSale(user.id, { items: [{ productId: cheap.id, quantity: 1 }] });
    await createSale(user.id, { items: [{ productId: pricey.id, quantity: 1 }] });
  }

  it('ranks top products by numeric revenue (1500 before 9), not as text', async () => {
    await seedTwoSellers();
    const { start, end } = range();
    const rows = await getTopProducts(start, end);
    expect(rows.map((r) => r.productName)).toEqual(['غالي', 'رخيص']);
  });

  it('ranks categories by numeric revenue too', async () => {
    const user = await seedUser();
    const a = await prisma.category.create({ data: { name: `أ-${Math.random()}` } });
    const b = await prisma.category.create({ data: { name: `ب-${Math.random()}` } });
    const cheap = await prisma.product.create({ data: { name: 'x', salePrice: '9', purchasePrice: '1', categoryId: a.id } });
    const pricey = await prisma.product.create({ data: { name: 'y', salePrice: '1500', purchasePrice: '1', categoryId: b.id } });
    await prisma.batch.create({ data: { productId: cheap.id, quantity: 5 } });
    await prisma.batch.create({ data: { productId: pricey.id, quantity: 5 } });
    await createSale(user.id, { items: [{ productId: cheap.id, quantity: 1 }] });
    await createSale(user.id, { items: [{ productId: pricey.id, quantity: 1 }] });

    const { start, end } = range();
    const rows = await getRevenueByCategory(start, end);
    expect(rows.map((r) => r.categoryName)).toEqual([b.name, a.name]);
  });
});
