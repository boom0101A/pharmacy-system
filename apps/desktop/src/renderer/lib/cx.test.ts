import { afterEach, describe, expect, it, vi } from 'vitest';
import { baghdadToday } from './cx';

describe('baghdadToday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the next calendar day during the first ~3 hours after Baghdad midnight, when UTC is still on the previous day', () => {
    // 2026-09-12 21:30 UTC = 2026-09-13 00:30 Baghdad (UTC+3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T21:30:00.000Z'));
    expect(baghdadToday()).toBe('2026-09-13');
  });

  it('agrees with the plain UTC date away from the day boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    expect(baghdadToday()).toBe('2026-09-12');
  });

  it('still rolls over correctly right at the UTC day boundary', () => {
    // 2026-09-12 23:59 UTC = 2026-09-13 02:59 Baghdad.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T23:59:00.000Z'));
    expect(baghdadToday()).toBe('2026-09-13');
  });
});

describe('digitsOnly', () => {
  it('keeps digits typed on an Arabic keyboard, as plain digits', async () => {
    const { digitsOnly } = await import('./cx');
    expect(digitsOnly('١٠٤٢')).toBe('1042');
    expect(digitsOnly('۱۲ علبة')).toBe('12');
  });
});
