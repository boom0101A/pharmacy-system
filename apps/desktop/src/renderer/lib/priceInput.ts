/**
 * Live thousands-separator formatting for a price field — matches
 * `formatMoney`'s convention (whole Iraqi dinars, no fraction digits) used
 * everywhere else this app displays a price. The one real hazard with
 * formatting-as-you-type is the cursor jumping to the wrong spot every time
 * a comma is added or removed; this is solved by counting *digits* (never
 * commas) before the cursor in the new input, then placing the cursor after
 * that same digit-count in the freshly-formatted string — commas shifting
 * around never changes how many real digits precede the cursor.
 */
export function reformatPriceInput(
  rawValue: string,
  cursorPos: number,
): { formatted: string; cursorPos: number } {
  const digitsBeforeCursor = rawValue.slice(0, cursorPos).replace(/[^\d]/g, '').length;
  const digits = rawValue.replace(/[^\d]/g, '');
  const formatted = digits ? new Intl.NumberFormat('en-US').format(Number(digits)) : '';

  if (digitsBeforeCursor === 0) {
    return { formatted, cursorPos: 0 };
  }

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitsBeforeCursor) {
        return { formatted, cursorPos: i + 1 };
      }
    }
  }
  return { formatted, cursorPos: formatted.length };
}

/**
 * Reads a price field that may carry thousands separators ("1,500"). An
 * empty field is 0; anything else that isn't a whole number is `null` —
 * `Number('1,500') || 0` used to save such input as a zero cost silently,
 * inflating every profit figure built on that batch.
 */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}
