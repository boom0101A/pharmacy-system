// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Splash } from './Splash';

function setReducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: on, addEventListener: vi.fn(), removeEventListener: vi.fn() });
}

describe('Splash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });
  afterEach(() => vi.useRealTimers());

  it('shows the name and finishes after about 2.2 seconds plus the exit', () => {
    const onFinish = vi.fn();
    render(<Splash onFinish={onFinish} />);
    expect(screen.getByRole('status', { name: 'جارٍ تشغيل نظام الصيدلية' }).textContent).toMatch(/نظام\s*الصيدلية/);

    act(() => vi.advanceTimersByTime(2100));
    expect(onFinish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100)); // dwell over → exit starts
    act(() => vi.advanceTimersByTime(400)); // exit done
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a click', () => fireEvent.pointerDown(window)],
    ['any key', () => fireEvent.keyDown(window, { key: 'Enter' })],
  ])('skips straight to the exit on %s', (_label, skip) => {
    const onFinish = vi.fn();
    render(<Splash onFinish={onFinish} />);
    act(() => skip());
    act(() => vi.advanceTimersByTime(400));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('gets out of the way at once with reduced motion', () => {
    setReducedMotion(true);
    const onFinish = vi.fn();
    render(<Splash onFinish={onFinish} />);
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(0));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
