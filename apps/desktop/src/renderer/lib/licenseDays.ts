/** Whole days until a license ends, rounded up (anything left today counts as a day); null when perpetual. */
export function licenseDaysLeft(expiresAt: string | null, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}

/** How far ahead the admin is warned, so a renewal key can be requested in time. */
export const LICENSE_WARNING_DAYS = 3;
