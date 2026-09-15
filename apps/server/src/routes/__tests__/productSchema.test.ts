import { describe, expect, it } from 'vitest';
import { productSchema } from '../products.routes.js';

const base = {
  name: 'بنادول',
  unit: 'علبة',
  salePrice: 1000,
  purchasePrice: 500,
  reorderLevel: 10,
};

describe('productSchema sub-unit consistency', () => {
  it('accepts a product with no sub-unit configured at all', () => {
    expect(() => productSchema.parse(base)).not.toThrow();
  });

  it('accepts a product with all three sub-unit fields set together', () => {
    expect(() =>
      productSchema.parse({ ...base, unitsPerPackage: 10, subUnitName: 'حبة', subUnitPrice: 150 }),
    ).not.toThrow();
  });

  it('rejects unitsPerPackage set without a matching subUnitPrice — the exact state that silently overcharges 10x at checkout', () => {
    expect(() => productSchema.parse({ ...base, unitsPerPackage: 10, subUnitName: 'حبة' })).toThrow();
  });

  it('rejects subUnitPrice set alone, with no unitsPerPackage/subUnitName', () => {
    expect(() => productSchema.parse({ ...base, subUnitPrice: 150 })).toThrow();
  });
});

describe('productSchema price fields', () => {
  it('rejects Infinity as a sale price', () => {
    expect(() => productSchema.parse({ ...base, salePrice: Infinity })).toThrow();
  });

  it('rejects Infinity as a purchase price', () => {
    expect(() => productSchema.parse({ ...base, purchasePrice: Infinity })).toThrow();
  });

  it('rejects Infinity as a sub-unit price', () => {
    expect(() =>
      productSchema.parse({ ...base, unitsPerPackage: 10, subUnitName: 'حبة', subUnitPrice: Infinity }),
    ).toThrow();
  });
});
