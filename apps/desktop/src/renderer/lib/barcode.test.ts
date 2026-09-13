import { describe, expect, it } from 'vitest';
import { generateInternalBarcode } from './barcode';

describe('generateInternalBarcode', () => {
  it('prefixes the product id with "20" and pads it to 10 digits', () => {
    expect(generateInternalBarcode(42)).toBe('200000000042');
  });

  it('produces different codes for different product ids', () => {
    expect(generateInternalBarcode(1)).not.toBe(generateInternalBarcode(2));
  });

  it('is stable — the same id always produces the same code', () => {
    expect(generateInternalBarcode(123)).toBe(generateInternalBarcode(123));
  });

  it('handles a large product id without truncation', () => {
    expect(generateInternalBarcode(9999999999)).toBe('209999999999');
  });
});
