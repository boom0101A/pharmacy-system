import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCaptureCode, pendingCaptureCodeCount, resolveCaptureCode } from './captureCode.service.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('captureCode TTL cleanup', () => {
  it('removes an unconsumed code once its TTL passes, instead of holding it in memory forever', () => {
    const before = pendingCaptureCodeCount();
    createCaptureCode(1);
    expect(pendingCaptureCodeCount()).toBe(before + 1);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(pendingCaptureCodeCount()).toBe(before);
  });

  it('still resolves the code normally before its TTL elapses', () => {
    const code = createCaptureCode(7);
    vi.advanceTimersByTime(60 * 1000);

    const resolved = resolveCaptureCode(code);

    expect(resolved?.productId).toBe(7);
  });
});
