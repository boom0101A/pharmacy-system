import { describe, expect, it } from 'vitest';
import { startOfTodayBaghdad } from './dateRange.js';

describe('startOfTodayBaghdad', () => {
  it('returns Baghdad midnight for a moment shortly after local midnight (system/UTC time is still "yesterday")', () => {
    // 2026-01-15 04:30 Baghdad (+03:00) = 2026-01-15 01:30 UTC — a naive
    // `new Date(); setHours(0,0,0,0)` reading the UTC day would anchor to
    // Jan 15 00:00 UTC (03:00 Baghdad), three hours late.
    const now = new Date('2026-01-15T01:30:00.000Z');
    expect(startOfTodayBaghdad(now).toISOString()).toBe('2026-01-14T21:00:00.000Z');
  });

  it('returns Baghdad midnight for a moment after Baghdad has already rolled to the next day (system/UTC time is still "today")', () => {
    // 2026-01-16 02:00 Baghdad = 2026-01-15 23:00 UTC — the UTC calendar day
    // is still the 15th, but Baghdad's "today" is already the 16th.
    const now = new Date('2026-01-15T23:00:00.000Z');
    expect(startOfTodayBaghdad(now).toISOString()).toBe('2026-01-15T21:00:00.000Z');
  });

  it('is idempotent exactly at the Baghdad midnight boundary', () => {
    const baghdadMidnightUtc = new Date('2026-01-14T21:00:00.000Z');
    expect(startOfTodayBaghdad(baghdadMidnightUtc).toISOString()).toBe('2026-01-14T21:00:00.000Z');
  });
});
