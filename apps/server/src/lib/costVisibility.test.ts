import { describe, expect, it } from 'vitest';
import { withoutCostFor } from './costVisibility.js';

const rows = [{ id: 1, salePrice: 10, purchasePrice: 6 }];

describe('withoutCostFor', () => {
  it('removes purchasePrice for a cashier', () => {
    expect(withoutCostFor('cashier', rows)).toEqual([{ id: 1, salePrice: 10 }]);
  });

  it('keeps purchasePrice for admin and pharmacist', () => {
    expect(withoutCostFor('admin', rows)).toEqual(rows);
    expect(withoutCostFor('pharmacist', rows)).toEqual(rows);
  });
});
