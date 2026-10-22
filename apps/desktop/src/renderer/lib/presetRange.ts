export type RangePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear';

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: 'last7', label: 'آخر 7 أيام' },
  { key: 'thisMonth', label: 'هذا الشهر' },
  { key: 'lastMonth', label: 'الشهر الماضي' },
  { key: 'thisYear', label: 'هذه السنة' },
];

// Plain calendar dates in UTC arithmetic — "today" comes in as Baghdad's date
// already (baghdadToday), so no timezone is applied here.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (day: string) => new Date(`${day}T00:00:00Z`);
const shift = (day: string, days: number) => {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

/** The from/to dates (inclusive, YYYY-MM-DD) behind each quick-range button. */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const day = shift(today, -1);
      return { from: day, to: day };
    }
    case 'last7':
      return { from: shift(today, -6), to: today };
    case 'thisMonth':
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: today };
    case 'lastMonth':
      return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(new Date(Date.UTC(y, m - 1, 0))) };
    case 'thisYear':
      return { from: `${y}-01-01`, to: today };
  }
}
