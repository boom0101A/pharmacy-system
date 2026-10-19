/** UPC-A check digit for 11 digits: odd positions weigh 3, even weigh 1. */
export function upcCheckDigit(first11: string): number {
  const sum = [...first11].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * A 12-digit code for a product with no manufacturer barcode: the "20"
 * in-store prefix (never assigned to manufacturers), nine random digits, and
 * a real check digit so it stays valid if ever printed as a standard barcode.
 * Uniqueness is the caller's job — see newUniqueBarcode.
 */
export function internalBarcode(random: () => number = Math.random): string {
  const body = '20' + String(Math.floor(random() * 1e9)).padStart(9, '0');
  return body + upcCheckDigit(body);
}
