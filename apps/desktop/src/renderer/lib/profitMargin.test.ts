import { describe, expect, it } from 'vitest';
import { profitMargin } from './profitMargin';

describe('profitMargin', () => {
  it('divides profit by the same net-of-returns revenue the profit report used', () => {
    // Revenue 1000 net of returns, cost 750 → 25%, not profit / gross sales.
    expect(profitMargin([{ revenue: 1000, profit: 250 }])).toBe(25);
  });

  it('is 0 when there is no revenue', () => {
    expect(profitMargin([])).toBe(0);
  });
});
