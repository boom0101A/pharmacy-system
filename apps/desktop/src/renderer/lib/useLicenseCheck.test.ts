// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicenseCheck } from './useLicenseCheck';

describe('useLicenseCheck', () => {
  beforeEach(() => {
    (window as unknown as { pharmacy: unknown }).pharmacy = { getLicenseStatus: vi.fn() };
  });

  it('surfaces a clear error and stops waiting when the IPC call rejects', async () => {
    (window.pharmacy.getLicenseStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('تعذّر قراءة معرّف الجهاز من سجل ويندوز'),
    );

    const { result } = renderHook(() => useLicenseCheck());

    await waitFor(() => {
      expect(result.current.licensed).toBe(false);
    });
    expect(result.current.error).toBe('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
  });

  it('resolves normally when the license check succeeds', async () => {
    (window.pharmacy.getLicenseStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      payload: {},
    });

    const { result } = renderHook(() => useLicenseCheck());

    await waitFor(() => {
      expect(result.current.licensed).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });
});

describe('useLicenseCheck while the app stays open', () => {
  const VALID = { valid: true, payload: { expiresAt: '2026-10-21T00:00:00.000Z' } } as unknown as LicenseCheck;
  const EXPIRED: LicenseCheck = { valid: false, error: 'انتهت صلاحية هذا المفتاح' };

  beforeEach(() => {
    (window as unknown as { pharmacy: unknown }).pharmacy = { getLicenseStatus: vi.fn() };
  });

  it('notices within a minute that the license has run out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(window.pharmacy.getLicenseStatus).mockResolvedValueOnce(VALID).mockResolvedValue(EXPIRED);
      const { result } = renderHook(() => useLicenseCheck());
      await waitFor(() => expect(result.current.licensed).toBe(true));

      await act(() => vi.advanceTimersByTimeAsync(60_000));

      await waitFor(() => expect(result.current.licensed).toBe(false));
    } finally {
      vi.useRealTimers();
    }
  });

  it('checks again when the window comes back into focus', async () => {
    vi.mocked(window.pharmacy.getLicenseStatus).mockResolvedValueOnce(VALID).mockResolvedValue(EXPIRED);
    const { result } = renderHook(() => useLicenseCheck());
    await waitFor(() => expect(result.current.licensed).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.licensed).toBe(false));
  });

  it('stops checking once unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(window.pharmacy.getLicenseStatus).mockResolvedValue(VALID);
      const { unmount } = renderHook(() => useLicenseCheck());
      await waitFor(() => expect(window.pharmacy.getLicenseStatus).toHaveBeenCalledTimes(1));
      unmount();

      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
      window.dispatchEvent(new Event('focus'));

      expect(window.pharmacy.getLicenseStatus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
