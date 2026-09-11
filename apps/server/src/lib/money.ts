/**
 * All money arithmetic (discounts, return shares) happens in minor units to
 * avoid floating-point drift when a total is split into fractions. The
 * database and every display value stay in major units (dinars).
 */
const MINOR_UNITS_PER_MAJOR = 100;

export function toMinorUnits(major: number): number {
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

export function fromMinorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}
