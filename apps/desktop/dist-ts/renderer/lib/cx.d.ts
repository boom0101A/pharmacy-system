/** Joins class names, dropping falsy values. Keeps CSS Module call sites tidy. */
export declare function cx(...classes: Array<string | false | null | undefined>): string;
/** Every device on the LAN resolves a product photo through the server, never a local path. */
export declare function productImageUrl(imageFilename: string | null): string | null;
/** Formats money the way the receipts and totals should read. */
export declare function formatMoney(value: number): string;
/**
 * Electron wraps a thrown main-process error as
 * `Error invoking remote method '<channel>': Error: <message>` — strips that
 * wrapper so an IPC failure (e.g. the printer-not-connected message) reads as
 * cleanly in a toast as any other error in the app.
 */
export declare function cleanIpcError(message: string): string;
/** Strips everything but digits — turns a comma-formatted price input back into raw digits. */
export declare function digitsOnly(value: string): string;
/** Comma-grouped thousands for a raw digit string while typing, e.g. "2500" -> "2,500". */
export declare function formatThousands(digits: string): string;
export declare function formatDate(value: string | null): string;
export declare function formatTime(value: string): string;
/** Days until a date; negative once it has passed. */
export declare function daysUntil(value: string | null): number | null;
/**
 * A short warning tone — the only way a busy cashier notices a scan that got
 * silently capped at the remaining stock instead of adding another unit.
 * Best-effort: a test/jsdom environment or blocked autoplay just stays silent.
 */
export declare function playWarningBeep(): void;
