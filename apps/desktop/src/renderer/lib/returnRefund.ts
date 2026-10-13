interface RefundableItem {
  id: number;
  quantity: number;
  unitPrice: number;
}

/**
 * Mirrors returns.service.ts on the server: the customer paid the
 * discounted share of the invoice, so that same share is what comes back.
 * Showing the list price instead had the cashier hand over more than the
 * server records — the drawer ends the day short by the discount.
 */
export function refundPreview(
  saleItems: RefundableItem[],
  quantities: Record<number, number>,
  saleDiscount: number,
): number {
  const subtotal = saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const paidRatio = subtotal > 0 ? Math.min(1, Math.max(0, (subtotal - saleDiscount) / subtotal)) : 0;
  return saleItems.reduce(
    (sum, item) => sum + Math.round((quantities[item.id] ?? 0) * item.unitPrice * paidRatio),
    0,
  );
}
