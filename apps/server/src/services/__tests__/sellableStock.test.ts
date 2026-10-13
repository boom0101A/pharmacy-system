import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { findByBarcode } from '../products.service.js';
import { writeOffBatch } from '../batches.service.js';

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const barcode = () => `bc-${Date.now()}-${Math.random()}`;

describe('sellable stock', () => {
  it('excludes expired batches from stock and from nearestExpiry', async () => {
    const code = barcode();
    const product = await prisma.product.create({ data: { name: 'منتهي جزئياً', salePrice: '10', purchasePrice: '5', barcode: code } });
    await prisma.batch.create({ data: { productId: product.id, quantity: 3, expiryDate: day(-5) } });
    const valid = day(10);
    await prisma.batch.create({ data: { productId: product.id, quantity: 4, expiryDate: valid } });

    const p = await findByBarcode(code);

    expect(p?.stock).toBe(4);
    expect(p?.nearestExpiry?.slice(0, 10)).toBe(valid.toISOString().slice(0, 10));
  });

  it('reports loose sub-units left in an opened package', async () => {
    const code = barcode();
    const product = await prisma.product.create({
      data: { name: 'شرائط', salePrice: '100', purchasePrice: '50', barcode: code, unitsPerPackage: 10, subUnitName: 'شريط', subUnitPrice: '12' },
    });
    await prisma.batch.create({ data: { productId: product.id, quantity: 0, openedSubUnits: 9 } });

    expect((await findByBarcode(code))?.looseSubUnits).toBe(9);
  });
});

describe('write-off clears loose sub-units too', () => {
  it('zeroes openedSubUnits of the written-off batch', async () => {
    const user = await prisma.user.create({
      data: { name: 'ص', username: `p-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'pharmacist' },
    });
    const product = await prisma.product.create({
      data: { name: 'شرائط منتهية', salePrice: '100', purchasePrice: '50', unitsPerPackage: 10, subUnitName: 'شريط', subUnitPrice: '12' },
    });
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 1, openedSubUnits: 2, expiryDate: day(-3) },
    });

    await writeOffBatch(batch.id, user.id);

    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).openedSubUnits).toBe(0);
  });
});

describe('write-off of a batch holding only loose sub-units', () => {
  it('is allowed, since those strips are just as expired', async () => {
    const user = await prisma.user.create({
      data: { name: 'ص', username: `p-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'pharmacist' },
    });
    const product = await prisma.product.create({
      data: { name: 'شرائط فقط', salePrice: '100', purchasePrice: '50', unitsPerPackage: 10, subUnitName: 'شريط', subUnitPrice: '12' },
    });
    const batch = await prisma.batch.create({
      data: { productId: product.id, quantity: 0, openedSubUnits: 3, expiryDate: day(-2) },
    });

    await writeOffBatch(batch.id, user.id);

    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } })).openedSubUnits).toBe(0);
  });
});
