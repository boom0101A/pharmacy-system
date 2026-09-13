// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  reportSales: vi.fn(),
  reportTopProducts: vi.fn(),
  reportByCategory: vi.fn(),
  reportExpiry: vi.fn(),
  reportLowStock: vi.fn(),
  reportProfit: vi.fn(),
};
vi.mock('./api.js', () => ({ api }));

const { useReportsData } = await import('./useReportsData');

function resolveAllOnce() {
  api.reportSales.mockResolvedValue([{ date: '2026-09-13', total: 100, count: 1 }]);
  api.reportTopProducts.mockResolvedValue([]);
  api.reportByCategory.mockResolvedValue([]);
  api.reportExpiry.mockResolvedValue([]);
  api.reportLowStock.mockResolvedValue([]);
  api.reportProfit.mockResolvedValue([]);
}

describe('useReportsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the "to" date through to the expiry report, not just the sales-range reports', async () => {
    resolveAllOnce();
    renderHook(() => useReportsData('2026-08-01', '2026-09-13', true));

    await waitFor(() => expect(api.reportExpiry).toHaveBeenCalled());
    expect(api.reportExpiry).toHaveBeenCalledWith(undefined, '2026-09-13');
  });

  it('keeps every other report populated when exactly one report fails, with the failure recorded per-report instead of losing which one it was', async () => {
    resolveAllOnce();
    api.reportProfit.mockRejectedValue(new Error('تعذّر تحميل الأرباح'));

    const { result } = renderHook(() => useReportsData('2026-08-01', '2026-09-13', true));

    await waitFor(() => expect(result.current.sales).toHaveLength(1));
    expect(result.current.errors.profit).toBe('تعذّر تحميل الأرباح');
    expect(result.current.errors.sales).toBeUndefined();
  });

  it('does not request the profit report at all for a role that cannot see it', async () => {
    resolveAllOnce();
    renderHook(() => useReportsData('2026-08-01', '2026-09-13', false));

    await waitFor(() => expect(api.reportSales).toHaveBeenCalled());
    expect(api.reportProfit).not.toHaveBeenCalled();
  });
});
