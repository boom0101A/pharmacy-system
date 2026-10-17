// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
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
