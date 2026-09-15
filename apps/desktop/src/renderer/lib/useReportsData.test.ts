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
  reportWriteOffs: vi.fn(),
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
  api.reportWriteOffs.mockResolvedValue([]);
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

  it('ignores a stale response that resolves after a newer request was already made for a different range', async () => {
    resolveAllOnce();
    let resolveFirst!: (value: { date: string; total: number; count: number }[]) => void;
    const firstCall = new Promise<{ date: string; total: number; count: number }[]>((resolve) => {
      resolveFirst = resolve;
    });
    let resolveSecond!: (value: { date: string; total: number; count: number }[]) => void;
    const secondCall = new Promise<{ date: string; total: number; count: number }[]>((resolve) => {
      resolveSecond = resolve;
    });
    api.reportSales.mockReturnValueOnce(firstCall).mockReturnValueOnce(secondCall);

    const { result, rerender } = renderHook(({ from, to }) => useReportsData(from, to, true), {
      initialProps: { from: '2026-08-01', to: '2026-09-01' },
    });
    rerender({ from: '2026-08-01', to: '2026-09-13' });

    // The newer (second) request answers first — resolves normally.
    resolveSecond([{ date: '2026-09-13', total: 999, count: 9 }]);
    await waitFor(() => expect(result.current.sales).toHaveLength(1));
    expect(result.current.sales[0].total).toBe(999);

    // The stale (first) request finally answers, after being superseded.
    resolveFirst([{ date: '2026-08-01', total: 1, count: 1 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.sales[0].total).toBe(999);
  });

  it('loads the write-offs report regardless of date range, since it is a log, not a bucketed chart', async () => {
    resolveAllOnce();
    api.reportWriteOffs.mockResolvedValue([
      { id: 1, productName: 'دواء منتهي', quantity: 3, batchExpiryDate: null, userName: 'صيدلاني', createdAt: '2026-09-13T00:00:00.000Z' },
    ]);

    const { result } = renderHook(() => useReportsData('2026-08-01', '2026-09-13', true));

    await waitFor(() => expect(result.current.writeOffs).toHaveLength(1));
    expect(api.reportWriteOffs).toHaveBeenCalledWith();
  });
});
