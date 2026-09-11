import { getServerUrl } from './api';
/** Joins class names, dropping falsy values. Keeps CSS Module call sites tidy. */
export function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}
/** Every device on the LAN resolves a product photo through the server, never a local path. */
export function productImageUrl(imageFilename) {
    return imageFilename ? `${getServerUrl()}/uploads/products/${imageFilename}` : null;
}
// The ar-IQ locale defaults to Eastern Arabic-Indic digits (٠١٢٣...), but
// counts and quantities elsewhere in the app render as plain Western digits
// via String(n) — forcing -nu-latn keeps money and dates consistent with that.
const LOCALE_WESTERN_DIGITS = 'ar-IQ-u-nu-latn';
/** Formats money the way the receipts and totals should read. */
export function formatMoney(value) {
    return new Intl.NumberFormat(LOCALE_WESTERN_DIGITS, { maximumFractionDigits: 0 }).format(value);
}
/**
 * Electron wraps a thrown main-process error as
 * `Error invoking remote method '<channel>': Error: <message>` — strips that
 * wrapper so an IPC failure (e.g. the printer-not-connected message) reads as
 * cleanly in a toast as any other error in the app.
 */
export function cleanIpcError(message) {
    return message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '');
}
/** Strips everything but digits — turns a comma-formatted price input back into raw digits. */
export function digitsOnly(value) {
    return value.replace(/[^\d]/g, '');
}
/** Comma-grouped thousands for a raw digit string while typing, e.g. "2500" -> "2,500". */
export function formatThousands(digits) {
    if (!digits)
        return '';
    return new Intl.NumberFormat('en-US').format(Number(digits));
}
export function formatDate(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat(LOCALE_WESTERN_DIGITS, { dateStyle: 'medium' }).format(new Date(value));
}
export function formatTime(value) {
    return new Intl.DateTimeFormat(LOCALE_WESTERN_DIGITS, { timeStyle: 'short' }).format(new Date(value));
}
/** Days until a date; negative once it has passed. */
export function daysUntil(value) {
    if (!value)
        return null;
    const diff = new Date(value).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
}
// One shared context: creating a fresh AudioContext per beep leaks a handle
// every scan and some browsers cap how many can exist at once.
let sharedAudioCtx = null;
/**
 * A short warning tone — the only way a busy cashier notices a scan that got
 * silently capped at the remaining stock instead of adding another unit.
 * Best-effort: a test/jsdom environment or blocked autoplay just stays silent.
 */
export function playWarningBeep() {
    try {
        const Ctx = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctx)
            return;
        sharedAudioCtx ??= new Ctx();
        const ctx = sharedAudioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    }
    catch {
        // Silence is an acceptable fallback for a tone whose only job is a hint.
    }
}
