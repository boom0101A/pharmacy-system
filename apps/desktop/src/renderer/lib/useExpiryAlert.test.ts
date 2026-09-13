// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { dashboard: vi.fn() };
vi.mock('./api.js', () => ({ api }));

const { useExpiryAlertState } = await import('../store/expiryAlert.js');
const { useExpiryAlert } = await import('./useExpiryAlert');

function summary(expiringSoonCount: number) {
  return {
    todaySalesTotal: 0,
    todaySalesCount: 0,
    lowStockCount: 0,
    expiringSoonCount,
    lowStock: [],
    expiringSoon: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useExpiryAlertState.setState({ lastAlertedCount: null, pendingAlert: null });
});

describe('useExpiryAlert', () => {
  it('does nothing when disabled', async () => {
    api.dashboard.mockResolvedValue(summary(3));
    renderHook(() => useExpiryAlert(false));
    await new Promise((r) => setTimeout(r, 10));
    expect(api.dashboard).not.toHaveBeenCalled();
  });

  it('raises a pending alert on the first check when items are already expiring soon', async () => {
    api.dashboard.mockResolvedValue(summary(3));
    renderHook(() => useExpiryAlert(true));

    await waitFor(() => {
      expect(useExpiryAlertState.getState().pendingAlert).toEqual({ count: 3 });
    });
    expect(useExpiryAlertState.getState().lastAlertedCount).toBe(3);
  });

  it('does not raise a second alert for the same unchanged count', async () => {
    useExpiryAlertState.setState({ lastAlertedCount: 3, pendingAlert: null });
    api.dashboard.mockResolvedValue(summary(3));
    renderHook(() => useExpiryAlert(true));

    await waitFor(() => expect(api.dashboard).toHaveBeenCalled());
    expect(useExpiryAlertState.getState().pendingAlert).toBeNull();
  });

  it('raises a fresh alert when the count changes from what was last alerted', async () => {
    useExpiryAlertState.setState({ lastAlertedCount: 3, pendingAlert: null });
    api.dashboard.mockResolvedValue(summary(5));
    renderHook(() => useExpiryAlert(true));

    await waitFor(() => {
      expect(useExpiryAlertState.getState().pendingAlert).toEqual({ count: 5 });
    });
  });

  it('never raises an alert when nothing is expiring soon', async () => {
    api.dashboard.mockResolvedValue(summary(0));
    renderHook(() => useExpiryAlert(true));

    await waitFor(() => expect(api.dashboard).toHaveBeenCalled());
    expect(useExpiryAlertState.getState().pendingAlert).toBeNull();
  });

  it('does not double-alert when React StrictMode mounts, unmounts, and remounts the hook before the first check resolves', async () => {
    const resolvers: Array<(value: ReturnType<typeof summary>) => void> = [];
    api.dashboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const setPendingAlertSpy = vi.spyOn(useExpiryAlertState.getState(), 'setPendingAlert');

    const { unmount } = renderHook(() => useExpiryAlert(true));
    unmount();
    renderHook(() => useExpiryAlert(true));

    expect(resolvers).toHaveLength(2);
    resolvers[0](summary(3));
    resolvers[1](summary(3));

    await waitFor(() => {
      expect(useExpiryAlertState.getState().pendingAlert).toEqual({ count: 3 });
    });
    // The unmounted hook's own in-flight check must not also fire a second toast.
    expect(setPendingAlertSpy).toHaveBeenCalledTimes(1);
  });
});
