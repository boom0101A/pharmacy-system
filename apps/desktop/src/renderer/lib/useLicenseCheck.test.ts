// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
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
