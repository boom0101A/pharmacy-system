import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@pharmacy/shared-types';
import { findAlternativeProduct } from './alternativePick.js';

function fakeProduct(id: number): Product {
  return {
    id,
    name: `دواء ${id}`,
    barcode: null,
    categoryId: null,
    categoryName: null,
    unit: 'علبة',
    salePrice: 100,
    purchasePrice: 50,
    reorderLevel: 5,
    stock: 10,
    imageFilename: null,
    nearestExpiry: null,
    unitsPerPackage: null,
    subUnitName: null,
    subUnitPrice: null,
    activeIngredient: null,
    dosageForm: null,
    strength: null,
  };
}

describe('findAlternativeProduct', () => {
  it('returns the already-loaded product without calling the server again', async () => {
    const loaded = [fakeProduct(1), fakeProduct(2)];
    const fetchAll = vi.fn();

    const result = await findAlternativeProduct(2, loaded, fetchAll);

    expect(result).toBe(loaded[1]);
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('fetches the full catalogue and finds the product by id when it is not already loaded', async () => {
    const fetchAll = vi.fn().mockResolvedValue([fakeProduct(9)]);

    const result = await findAlternativeProduct(9, [], fetchAll);

    expect(result?.id).toBe(9);
  });

  it('resolves to undefined instead of throwing when the product is not found anywhere', async () => {
    const fetchAll = vi.fn().mockResolvedValue([fakeProduct(1)]);

    const result = await findAlternativeProduct(404, [], fetchAll);

    expect(result).toBeUndefined();
  });

  it('propagates a network failure so the caller can show an error instead of it vanishing silently', async () => {
    const fetchAll = vi.fn().mockRejectedValue(new Error('تعذّر الاتصال بالخادم'));

    await expect(findAlternativeProduct(9, [], fetchAll)).rejects.toThrow('تعذّر الاتصال بالخادم');
  });
});
