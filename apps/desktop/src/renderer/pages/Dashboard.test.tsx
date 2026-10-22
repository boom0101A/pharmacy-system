// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardSummary, User } from '@pharmacy/shared-types';

const summary: DashboardSummary = {
  todaySalesTotal: 15000,
  todaySalesCount: 3,
  lowStockCount: 0,
  expiringSoonCount: 0,
  lowStock: [],
  expiringSoon: [],
};

vi.mock('../lib/api.js', () => ({
  api: {
    dashboard: vi.fn(() => Promise.resolve(summary)),
    categories: vi.fn(() => Promise.resolve([])),
    deleteCategory: vi.fn(() => Promise.resolve({ moved: 5 })),
  },
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

// jsdom has no matchMedia — useCountUp reads it once on mount to respect
// "prefers-reduced-motion", which does not otherwise exist in this environment.
window.matchMedia =
  window.matchMedia ??
  ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList);

const { ToastProvider } = await import('../components/ui/Toast');
const { useAuth } = await import('../store/auth');
const { Dashboard } = await import('./Dashboard');

function renderDashboard(role: User['role']) {
  useAuth.setState({
    user: { id: 1, name: 'مستخدم', username: 'u', role, isActive: true, mustChangePassword: false, createdAt: new Date().toISOString() },
  });
  render(
    <MemoryRouter>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('Dashboard sales-figure visibility', () => {
  it('shows today\'s sales cards to an admin', async () => {
    renderDashboard('admin');
    await waitFor(() => expect(screen.getByText('مبيعات اليوم')).toBeTruthy());
    expect(screen.getByText('عدد الفواتير')).toBeTruthy();
  });

  it('hides today\'s sales cards from a cashier, even though the server already zeroed the figures', async () => {
    renderDashboard('cashier');
    await waitFor(() => expect(screen.queryByText('أصناف منخفضة المخزون')).toBeTruthy());
    expect(screen.queryByText('مبيعات اليوم')).toBeNull();
    expect(screen.queryByText('عدد الفواتير')).toBeNull();
  });
});

describe('Dashboard — deleting a category', () => {
  const PAIN = { id: 1, name: 'مسكنات', productCount: 5 };
  const ACHES = { id: 2, name: 'آلام', productCount: 3 };

  async function deletePainMovingTo(value: string) {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.categories).mockResolvedValue([PAIN, ACHES]);
    vi.mocked(api.deleteCategory).mockClear();
    renderDashboard('pharmacist');
    fireEvent.click(await screen.findByRole('button', { name: 'حذف مسكنات' }));
    fireEvent.change(await screen.findByLabelText('انقل أدويته إلى'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    return api;
  }

  it('hides the chip at once and moves the medicines only after the undo window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = await deletePainMovingTo('2');

      await waitFor(() => expect(screen.queryByRole('button', { name: 'حذف مسكنات' })).toBeNull());
      expect(screen.getByText('ونُقلت أدويته إلى «آلام»')).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(4000));
      expect(api.deleteCategory).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(api.deleteCategory).toHaveBeenCalledWith(1, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('undo brings the chip back and never calls the server', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = await deletePainMovingTo('');

      fireEvent.click(await screen.findByRole('button', { name: /تراجع/ }));
      expect(await screen.findByRole('button', { name: 'حذف مسكنات' })).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(8000));
      expect(api.deleteCategory).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Dashboard — a category on its way out', () => {
  it('is not offered as a destination for another category’s medicines', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { api } = await import('../lib/api.js');
      const A = { id: 11, name: 'أ', productCount: 2 };
      const B = { id: 12, name: 'ب', productCount: 2 };
      const C = { id: 13, name: 'ج', productCount: 0 };
      vi.mocked(api.categories).mockResolvedValue([A, B, C]);
      renderDashboard('pharmacist');

      fireEvent.click(await screen.findByRole('button', { name: 'حذف أ' }));
      fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
      fireEvent.click(await screen.findByRole('button', { name: 'حذف ب' }));

      const select = (await screen.findByLabelText('انقل أدويته إلى')) as HTMLSelectElement;
      expect([...select.options].map((o) => o.textContent)).toEqual(['بدون تصنيف', 'ج']);
    } finally {
      vi.useRealTimers();
    }
  });
});
