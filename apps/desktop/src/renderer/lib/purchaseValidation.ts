interface PurchaseLineLike {
  productName: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Catches what the number inputs' `min` attribute doesn't — a browser lets a
 * negative value be typed straight into a `type="number"` field despite
 * `min`, and the server's own rejection is a single generic "بيانات غير
 * صالحة" with no indication of which line. Returns a clear Arabic message
 * naming the offending product, or null when every line is fine.
 */
export function findInvalidPurchaseLine(lines: PurchaseLineLike[]): string | null {
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return `الكمية غير صالحة لـ"${line.productName}" — يجب أن تكون رقماً صحيحاً أكبر من صفر`;
    }
    if (!(line.unitPrice > 0)) {
      return `سعر الشراء غير صالح لـ"${line.productName}" — يجب أن يكون أكبر من صفر`;
    }
  }
  return null;
}
