import { describe, expect, it } from 'vitest';
import { findInvalidPurchaseLine } from './purchaseValidation';

function line(overrides: Partial<{ productName: string; quantity: number; unitPrice: number }> = {}) {
  return { productName: 'دواء أ', quantity: 5, unitPrice: 1000, ...overrides };
}

describe('findInvalidPurchaseLine', () => {
  it('returns null when every line has a positive integer quantity and a positive price', () => {
    expect(findInvalidPurchaseLine([line(), line({ productName: 'دواء ب', quantity: 1 })])).toBeNull();
  });

  it('flags a negative quantity, naming the product', () => {
    const message = findInvalidPurchaseLine([line({ productName: 'دواء الكمية السالبة', quantity: -5 })]);
    expect(message).toContain('دواء الكمية السالبة');
  });

  it('flags a zero quantity', () => {
    expect(findInvalidPurchaseLine([line({ quantity: 0 })])).not.toBeNull();
  });

  it('flags a negative unit price, naming the product', () => {
    const message = findInvalidPurchaseLine([line({ productName: 'دواء السعر السالب', unitPrice: -100 })]);
    expect(message).toContain('دواء السعر السالب');
  });

  it('flags a zero unit price instead of silently accepting a free line', () => {
    expect(findInvalidPurchaseLine([line({ unitPrice: 0 })])).not.toBeNull();
  });

  it('flags a non-integer quantity', () => {
    expect(findInvalidPurchaseLine([line({ quantity: 2.5 })])).not.toBeNull();
  });
});
