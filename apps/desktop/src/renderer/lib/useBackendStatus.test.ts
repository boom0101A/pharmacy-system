// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBackendStatus } from './useBackendStatus';

describe('useBackendStatus', () => {
  it('keeps watching while disabled, so a backend started later (after licence activation) is still reported', async () => {
    const getBackendStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: 'disabled' })
      .mockResolvedValue({ status: 'starting', stage: 'database' });
    (window as unknown as { pharmacy: unknown }).pharmacy = { getBackendStatus };

    const { result } = renderHook(() => useBackendStatus());

    await waitFor(() => expect(result.current.status).toBe('starting'), { timeout: 8000 });
  }, 10_000);
});
