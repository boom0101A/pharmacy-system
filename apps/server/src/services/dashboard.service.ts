import type { Role } from '@pharmacy/shared-types';

/**
 * The dashboard stays open to every role — a cashier needs the same
 * low-stock/expiry warnings an admin does — but today's revenue is not
 * theirs to see, matching `canSeeProfit` in the desktop Reports page.
 */
export function maskSalesForRole(
  sales: { total: number; count: number },
  role: Role,
): { total: number; count: number } {
  if (role === 'admin' || role === 'pharmacist') return sales;
  return { total: 0, count: 0 };
}
