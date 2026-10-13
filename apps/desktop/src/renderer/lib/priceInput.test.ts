import { describe, expect, it } from 'vitest';
import { reformatPriceInput } from './priceInput';

describe('reformatPriceInput', () => {
  it('formats a freshly-typed digit with no cursor jump', () => {
    expect(reformatPriceInput('1', 1)).toEqual({ formatted: '1', cursorPos: 1 });
  });

  it('adds a thousands separator once a 4th digit is typed at the end, cursor staying right after what was typed', () => {
    // Field showed "1,234"; typing "5" at the end gives the browser "1,2345".
    expect(reformatPriceInput('1,2345', 6)).toEqual({ formatted: '12,345', cursorPos: 6 });
  });

  it('keeps the cursor right after an inserted digit in the middle of the number, not at the end', () => {
    // Field showed "12,345"; cursor placed between the two leading digits,
    // typing "9" gives the browser "129,345" with the cursor after the "9".
    expect(reformatPriceInput('129,345', 3)).toEqual({ formatted: '129,345', cursorPos: 3 });
  });

  it('keeps the cursor in place after a backspace removes a digit before it', () => {
    // Field showed "12,345"; backspacing the "2" gives the browser "1,345"
    // with the cursor left where the deleted digit was.
    expect(reformatPriceInput('1,345', 1)).toEqual({ formatted: '1,345', cursorPos: 1 });
  });

  it('clears to an empty string when every digit is deleted', () => {
    expect(reformatPriceInput('', 0)).toEqual({ formatted: '', cursorPos: 0 });
  });

  it('strips a decimal point instead of keeping it — Iraqi dinar prices are whole numbers everywhere else in this app', () => {
    expect(reformatPriceInput('12.5', 4)).toEqual({ formatted: '125', cursorPos: 3 });
  });
});

describe('parsePriceInput', async () => {
  const { parsePriceInput } = await import('./priceInput');

  it('reads a comma-formatted price', () => {
    expect(parsePriceInput('1,500')).toBe(1500);
  });

  it('treats an empty field as 0', () => {
    expect(parsePriceInput('')).toBe(0);
  });

  it('rejects text that is not a number instead of silently saving 0', () => {
    expect(parsePriceInput('15oo')).toBeNull();
  });
});
