import { describe, expect, it } from 'vitest';
import { internalBarcode, upcCheckDigit } from './barcode.js';

describe('internal barcodes', () => {
  it('computes the UPC-A check digit', () => {
    // A known valid UPC-A: 036000291452.
    expect(upcCheckDigit('03600029145')).toBe(2);
  });

  it('is 12 digits: the in-store prefix 20, nine random digits, and a valid check digit', () => {
    const code = internalBarcode(() => 0.123456789);
    expect(code).toMatch(/^20\d{10}$/);
    expect(Number(code[11])).toBe(upcCheckDigit(code.slice(0, 11)));
  });
});
