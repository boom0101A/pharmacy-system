/**
 * A Code128-compatible internal barcode derived purely from the product's
 * own id — always unique, no database lookup needed to avoid collisions.
 * The "20" prefix is the common in-store-use convention that visually marks
 * a code as internal rather than a manufacturer-issued barcode.
 */
export function generateInternalBarcode(productId: number): string {
  return '20' + String(productId).padStart(10, '0');
}
