import type { Role } from '@pharmacy/shared-types';

/**
 * Purchase cost is margin information — purchases.routes.ts keeps it with
 * admin/pharmacist. The product and batch lists are open to the cashier for
 * selling, so the cost field is stripped from what they return to that role.
 */
export function withoutCostFor<T extends { purchasePrice?: unknown }>(
  role: Role,
  rows: T[],
): (T | Omit<T, 'purchasePrice'>)[] {
  if (role !== 'cashier') return rows;
  return rows.map(({ purchasePrice: _cost, ...rest }) => rest);
}
