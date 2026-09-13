/**
 * Enough to bring stock back up to the reorder level exactly — never less
 * than 1, since a purchase line with quantity 0 has no meaning.
 */
export function suggestedReorderQuantity(reorderLevel: number, stock: number): number {
  return Math.max(reorderLevel - stock, 1);
}
