import { describe, expect, it } from 'vitest';
import { presetRange } from './presetRange';

describe('presetRange', () => {
  const today = '2026-03-15';

  it.each([
    ['today', { from: '2026-03-15', to: '2026-03-15' }],
    ['yesterday', { from: '2026-03-14', to: '2026-03-14' }],
    ['last7', { from: '2026-03-09', to: '2026-03-15' }],
    ['thisMonth', { from: '2026-03-01', to: '2026-03-15' }],
    ['lastMonth', { from: '2026-02-01', to: '2026-02-28' }],
    ['thisYear', { from: '2026-01-01', to: '2026-03-15' }],
  ] as const)('%s', (name, expected) => {
    expect(presetRange(name, today)).toEqual(expected);
  });

  it('crosses the year boundary for last month in January', () => {
    expect(presetRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('handles a leap February', () => {
    expect(presetRange('lastMonth', '2028-03-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
