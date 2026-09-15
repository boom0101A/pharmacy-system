import { describe, expect, it } from 'vitest';
import { maskSalesForRole } from './dashboard.service.js';

describe('maskSalesForRole', () => {
  it('passes today\'s sales figures through for admin', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'admin')).toEqual({ total: 15000, count: 3 });
  });

  it('passes today\'s sales figures through for pharmacist', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'pharmacist')).toEqual({ total: 15000, count: 3 });
  });

  it('zeroes today\'s sales figures for cashier — the dashboard stays visible for low-stock/expiry, but money figures do not', () => {
    expect(maskSalesForRole({ total: 15000, count: 3 }, 'cashier')).toEqual({ total: 0, count: 0 });
  });
});
