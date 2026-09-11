import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Cross } from 'lucide-react';
import styles from './Splash.module.css';
import { cx } from '../lib/cx';
/** How long the screen stays up, then how long it takes to fade away. */
const DWELL_MS = 1300;
const FADE_MS = 320;
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/**
 * The launch screen, shown once before the login form.
 *
 * It is purely cosmetic — it waits out a fixed duration rather than any real
 * startup work, so it must never gate anything the user needs. The two timers
 * check reduced-motion themselves: the global CSS override in tokens.css only
 * neutralises animations, it cannot shorten a setTimeout.
 */
export function Splash({ onFinish }) {
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setLeaving(true), prefersReducedMotion() ? 0 : DWELL_MS);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        if (!leaving)
            return;
        const timer = window.setTimeout(onFinish, prefersReducedMotion() ? 0 : FADE_MS);
        return () => window.clearTimeout(timer);
    }, [leaving, onFinish]);
    // The progress bar fills over exactly the dwell above, so the timing lives in
    // one place instead of drifting between the timer and the stylesheet.
    const timing = { '--splash-dwell': `${DWELL_MS}ms` };
    return (_jsx("div", { className: cx(styles.page, leaving && styles.leaving), style: timing, children: _jsxs("div", { className: styles.inner, children: [_jsx("span", { className: styles.mark, children: _jsx(Cross, { size: 44, strokeWidth: 2.25 }) }), _jsxs("div", { className: styles.text, children: [_jsx("h1", { className: styles.wordmark, children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629" }), _jsx("p", { className: styles.tagline, children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" })] }), _jsx("div", { className: styles.progress, children: _jsx("span", { className: styles.progressFill }) })] }) }));
}
