// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpiryAlertWatcher } from './ExpiryAlertWatcher';
import { useExpiryAlertState } from '../store/expiryAlert.js';

const warning = vi.fn();
vi.mock('./ui/Toast.js', () => ({
  useToast: () => ({ warning }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useExpiryAlertState.setState({ lastAlertedCount: null, pendingAlert: null });
});

afterEach(() => {
  useExpiryAlertState.setState({ lastAlertedCount: null, pendingAlert: null });
});

describe('ExpiryAlertWatcher', () => {
  it('renders nothing visible', () => {
    const { container } = render(<ExpiryAlertWatcher />);
    expect(container.innerHTML).toBe('');
  });

  it('does not show a toast when there is no pending alert', () => {
    render(<ExpiryAlertWatcher />);
    expect(warning).not.toHaveBeenCalled();
  });

  it('shows a warning toast naming the count when a pending alert appears, then clears it', () => {
    render(<ExpiryAlertWatcher />);

    act(() => {
      useExpiryAlertState.getState().setPendingAlert({ count: 4 });
    });

    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain('4');
    expect(useExpiryAlertState.getState().pendingAlert).toBeNull();
  });

  it('consumePendingAlert only returns the alert once, even called twice back-to-back', () => {
    useExpiryAlertState.getState().setPendingAlert({ count: 7 });

    const first = useExpiryAlertState.getState().consumePendingAlert();
    const second = useExpiryAlertState.getState().consumePendingAlert();

    expect(first).toEqual({ count: 7 });
    expect(second).toBeNull();
  });

  it('shows only one toast under React StrictMode, which double-invokes the same effect for one commit', () => {
    render(
      <StrictMode>
        <ExpiryAlertWatcher />
      </StrictMode>,
    );

    act(() => {
      useExpiryAlertState.getState().setPendingAlert({ count: 2 });
    });

    expect(warning).toHaveBeenCalledTimes(1);
  });
});
