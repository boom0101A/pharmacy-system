import { describe, expect, it } from 'vitest';
import { toErrorMessage } from './errorMessage.js';

describe('toErrorMessage', () => {
  it('returns a real Error object\'s message', () => {
    expect(toErrorMessage(new Error('فشل الاتصال'))).toBe('فشل الاتصال');
  });

  it('does not throw when the rejection is a bare string', () => {
    expect(toErrorMessage('something broke')).toBe('something broke');
  });

  it('does not throw when the rejection is null', () => {
    // A bare Promise.reject() rejects with undefined; casting that straight
    // to `(err as Error).message` throws inside the very catch block meant
    // to report the original failure, turning one clean "failed" status into
    // an unhandled rejection instead.
    expect(() => toErrorMessage(null)).not.toThrow();
  });

  it('does not throw when the rejection is undefined', () => {
    expect(() => toErrorMessage(undefined)).not.toThrow();
  });

  it('produces a readable fallback for a non-Error, non-string value', () => {
    expect(toErrorMessage({ weird: true })).toContain('weird');
  });
});
