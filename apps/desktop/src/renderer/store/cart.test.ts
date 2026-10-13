import { beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '@pharmacy/shared-types';
import { useCart } from './cart';

function product(id: number, salePrice = 100, stock = 10): Product {
  return {
    id,
    name: `دواء ${id}`,
    barcode: null,
    categoryId: null,
    categoryName: null,
    unit: 'علبة',
    salePrice,
    purchasePrice: 50,
    reorderLevel: 0,
    stock,
    imageFilename: null,
    nearestExpiry: null,
    unitsPerPackage: null,
    subUnitName: null,
    subUnitPrice: null,
    activeIngredient: null,
    dosageForm: null,
    strength: null,
    looseSubUnits: 0,
  };
}

beforeEach(() => useCart.getState().clear());

describe('cart', () => {
  it('removes a line whose quantity is set to 0, instead of keeping a line the server will reject', () => {
    useCart.getState().add(product(1), 2);
    useCart.getState().setQuantity(1, 0, false);
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('caps the discount at the cart subtotal', () => {
    useCart.getState().add(product(1, 100), 2);
    useCart.getState().setDiscount(500);
    expect(useCart.getState().discount).toBe(200);
  });

  it('rounds a fractional discount to whole dinars', () => {
    useCart.getState().add(product(1, 100), 1);
    useCart.getState().setDiscount(10.6);
    expect(useCart.getState().discount).toBe(11);
  });

  it('shrinks an existing discount when lines are removed below it', () => {
    useCart.getState().add(product(1, 100), 2);
    useCart.getState().setDiscount(150);
    useCart.getState().setQuantity(1, 1, false);
    expect(useCart.getState().discount).toBe(100);
  });
});

function divisible(stock: number, loose: number): Product {
  return {
    ...product(7, 100, stock),
    unitsPerPackage: 10,
    subUnitName: 'شريط',
    subUnitPrice: 12,
    looseSubUnits: loose,
  };
}

describe('sub-unit availability', () => {
  it('can sell loose strips left over in an opened box even when no whole box remains', () => {
    const { capped } = useCart.getState().add(divisible(0, 9), 9, true);
    expect(capped).toBe(false);
    expect(useCart.getState().lines[0].quantity).toBe(9);
  });

  it('shares one stock pool between the box line and the strip line', () => {
    const p = divisible(1, 0);
    useCart.getState().add(p, 1, false);
    const { capped } = useCart.getState().add(p, 10, true);
    expect(capped).toBe(true);
    expect(useCart.getState().lines.find((l) => l.isSubUnit)).toBeUndefined();
  });

  it('caps whole boxes once strips in the cart have needed to open one', () => {
    const p = divisible(2, 0);
    useCart.getState().add(p, 3, true);
    const { capped } = useCart.getState().add(p, 2, false);
    expect(capped).toBe(true);
    expect(useCart.getState().lines.find((l) => !l.isSubUnit)?.quantity).toBe(1);
  });
});
