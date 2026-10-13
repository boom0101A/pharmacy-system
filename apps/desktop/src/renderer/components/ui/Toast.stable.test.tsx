// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/sounds.js', () => ({
  playError: vi.fn(),
  playSuccess: vi.fn(),
  playExpiryAlert: vi.fn(),
  playDelete: vi.fn(),
}));

const { ToastProvider, useToast } = await import('./Toast');

describe('useToast identity', () => {
  it('stays the same object when a toast is shown, so effects depending on it do not re-run in a loop', async () => {
    const effectRuns = vi.fn();
    let showError: (() => void) | undefined;

    function Consumer() {
      const toast = useToast();
      showError = () => toast.error('خطأ');
      useEffect(() => {
        effectRuns();
      }, [toast]);
      return null;
    }

    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );
    expect(effectRuns).toHaveBeenCalledTimes(1);

    await act(async () => showError!());

    expect(effectRuns).toHaveBeenCalledTimes(1);
  });
});
