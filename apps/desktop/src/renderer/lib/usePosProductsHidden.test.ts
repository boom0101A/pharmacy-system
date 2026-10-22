// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePosProductsHidden } from './usePosProductsHidden';

describe('usePosProductsHidden', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('shows the products by default', () => {
    const { result } = renderHook(() => usePosProductsHidden());
    expect(result.current[0]).toBe(false);
  });

  it('remembers the choice on this machine', () => {
    const first = renderHook(() => usePosProductsHidden());
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(true);
    first.unmount();

    const again = renderHook(() => usePosProductsHidden());
    expect(again.result.current[0]).toBe(true);
  });

  it('still toggles when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePosProductsHidden());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});
