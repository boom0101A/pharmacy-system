import { getServerUrl } from './api';
import { normalizeDigits } from './priceInput';

/** Joins class names, dropping falsy values. Keeps CSS Module call sites tidy. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Every device on the LAN resolves a product photo through the server, never a local path. */
export function productImageUrl(imageFilename: string | null): string | null {
  return imageFilename ? `${getServerUrl()}/uploads/products/${imageFilename}` : null;
}

// The ar-IQ locale defaults to Eastern Arabic-Indic digits (٠١٢٣...), but
// counts and quantities elsewhere in the app render as plain Western digits
// via String(n) — forcing -nu-latn keeps money and dates consistent with that.
const LOCALE_WESTERN_DIGITS = 'ar-IQ-u-nu-latn';

/** Formats money the way the receipts and totals should read. */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat(LOCALE_WESTERN_DIGITS, { maximumFractionDigits: 0 }).format(value);
}

// Iraq has kept a fixed UTC+3 offset with no DST since 2007 — matches the
// same constant the server uses (apps/server/src/lib/dateRange.ts).
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * "Today" as Baghdad sees it, not UTC. Plain `new Date().toISOString()`
 * still reports *yesterday's* date for the first ~3 hours after Baghdad
 * midnight — a default report/return-browse range built from that quietly
 * excludes everything sold so far today until well past 3am.
 */
export function baghdadToday(): string {
  return new Date(Date.now() + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Electron wraps a thrown main-process error as
 * `Error invoking remote method '<channel>': Error: <message>` — strips that
 * wrapper so an IPC failure (e.g. the printer-not-connected message) reads as
 * cleanly in a toast as any other error in the app.
 */
export function cleanIpcError(message: string): string {
  return message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '');
}

/** Strips everything but digits — Arabic-keyboard digits (٠-٩) become plain ones first, not dropped. */
export function digitsOnly(value: string): string {
  return normalizeDigits(value).replace(/[^\d]/g, '');
}

/** Comma-grouped thousands for a raw digit string while typing, e.g. "2500" -> "2,500". */
export function formatThousands(digits: string): string {
  if (!digits) return '';
  return new Intl.NumberFormat('en-US').format(Number(digits));
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALE_WESTERN_DIGITS, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(LOCALE_WESTERN_DIGITS, { timeStyle: 'short' }).format(
    new Date(value),
  );
}

/** Days until a date; negative once it has passed. */
export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

