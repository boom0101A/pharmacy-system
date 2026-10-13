/**
 * Profit over the revenue the profit report itself used (net of the invoice
 * discount and of returns). Dividing by gross sales instead mixed two bases
 * and understated the margin whenever anything was returned.
 */
export function profitMargin(points: { revenue: number; profit: number }[]): number {
  const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const profit = points.reduce((sum, p) => sum + p.profit, 0);
  return revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
}
