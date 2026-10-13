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
    looseSubUnits: 0,
  };
}

describe('findAlternativeProduct', () => {
  it('returns the already-loaded product without calling the server again', async () => {
    const loaded = [fakeProduct(1), fakeProduct(2)];
    const fetchOne = vi.fn();

    const result = await findAlternativeProduct(2, loaded, fetchOne);

    expect(result).toBe(loaded[1]);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it('fetches that one product by id when it is not already loaded — not a capped page of the catalogue', async () => {
    const fetchOne = vi.fn().mockResolvedValue(fakeProduct(9));

    const result = await findAlternativeProduct(9, [], fetchOne);

    expect(fetchOne).toHaveBeenCalledWith(9);
    expect(result?.id).toBe(9);
  });

  it('propagates a network failure so the caller can show an error instead of it vanishing silently', async () => {
    const fetchOne = vi.fn().mockRejectedValue(new Error('تعذّر الاتصال بالخادم'));

    await expect(findAlternativeProduct(9, [], fetchOne)).rejects.toThrow('تعذّر الاتصال بالخادم');
  });
});

describe('newCaptureFilename', async () => {
  const { newCaptureFilename } = await import('./alternativePick.js');

  it('ignores the photo the product already had before the QR code was shown', () => {
    expect(newCaptureFilename('old.jpg', 'old.jpg')).toBeNull();
  });

  it('reports the new photo once it differs from the starting one', () => {
    expect(newCaptureFilename('old.jpg', 'new.jpg')).toBe('new.jpg');
    expect(newCaptureFilename(null, 'new.jpg')).toBe('new.jpg');
  });

  it('is null while there is still no photo', () => {
    expect(newCaptureFilename(null, null)).toBeNull();
  });
});
