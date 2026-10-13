import { describe, expect, it } from 'vitest';
import { refundPreview } from './returnRefund';

const items = [
  { id: 1, quantity: 1, unitPrice: 6000 },
  { id: 2, quantity: 2, unitPrice: 2000 },
];

describe('refundPreview', () => {
  it('applies the invoice discount share exactly like the server does', () => {
    // Subtotal 10000, discount 2000 → customer paid 80%.
    expect(refundPreview(items, { 1: 1, 2: 2 }, 2000)).toBe(8000);
  });

  it('is the plain price sum when there was no discount', () => {
    expect(refundPreview(items, { 2: 1 }, 0)).toBe(2000);
  });

  it('never goes negative for a legacy over-discounted invoice', () => {
    expect(refundPreview(items, { 1: 1 }, 50000)).toBe(0);
  });
});
