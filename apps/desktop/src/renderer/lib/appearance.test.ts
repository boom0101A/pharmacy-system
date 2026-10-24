// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStoredAppearance, useAppearance } from './appearance';

const html = () => document.documentElement;

describe('appearance', () => {
  beforeEach(() => {
    localStorage.clear();
    html().className = '';
    // The state is shared app-wide, so re-read the (now empty) storage.
    applyStoredAppearance();
  });
  afterEach(() => vi.restoreAllMocks());

  it('is light with glass by default', () => {
    applyStoredAppearance();
    expect(html().classList.contains('dark')).toBe(false);
    expect(html().classList.contains('perf')).toBe(false);
    const { result } = renderHook(() => useAppearance());
    expect(result.current.dark).toBe(false);
    expect(result.current.perf).toBe(false);
  });

  it('switches dark mode on <html> and remembers it on this machine', () => {
    const first = renderHook(() => useAppearance());
    act(() => first.result.current.setDark(true));
    expect(first.result.current.dark).toBe(true);
    expect(html().classList.contains('dark')).toBe(true);
    first.unmount();

    html().className = '';
    applyStoredAppearance();
    expect(html().classList.contains('dark')).toBe(true);
    expect(renderHook(() => useAppearance()).result.current.dark).toBe(true);
  });

  it('switches performance mode independently of the theme', () => {
    const { result } = renderHook(() => useAppearance());
    act(() => result.current.setPerf(true));
    expect(html().classList.contains('perf')).toBe(true);
    expect(html().classList.contains('dark')).toBe(false);

    act(() => result.current.setPerf(false));
    expect(html().classList.contains('perf')).toBe(false);
  });

  it('a switch flipped in one place shows in every other (top bar ↔ settings)', () => {
    const topBar = renderHook(() => useAppearance());
    const settings = renderHook(() => useAppearance());
    act(() => topBar.result.current.setDark(true));
    expect(settings.result.current.dark).toBe(true);
  });

  it('still switches when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => applyStoredAppearance()).not.toThrow();
    const { result } = renderHook(() => useAppearance());
    act(() => result.current.setDark(true));
    expect(result.current.dark).toBe(true);
    expect(html().classList.contains('dark')).toBe(true);
  });
});
