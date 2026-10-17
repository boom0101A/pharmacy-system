import { describe, expect, it } from 'vitest';
import { normalizeDigits, parsePriceInput, reformatPriceInput } from './priceInput';

describe('numbers typed on an Arabic keyboard', () => {
  it('normalizeDigits turns Arabic-Indic and Persian digits and separators into plain ones', () => {
    expect(normalizeDigits('٨٠٠٠')).toBe('8000');
    expect(normalizeDigits('۱۲۳')).toBe('123');
    expect(normalizeDigits('١٬٥٠٠٫٥')).toBe('1,500.5');
  });

  it('parsePriceInput reads them', () => {
    expect(parsePriceInput('٨٠٠٠')).toBe(8000);
    expect(parsePriceInput('١٬٥٠٠')).toBe(1500);
  });

  it('reformatPriceInput keeps them instead of wiping the field', () => {
    expect(reformatPriceInput('٨٠٠٠', 4)).toEqual({ formatted: '8,000', cursorPos: 5 });
  });
});
