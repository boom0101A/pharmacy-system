import { useEffect, useRef, useState } from 'react';
const DURATION_MS = 900;
/** Decelerating curve — the figure sprints, then eases into its final value. */
function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}
/**
 * Counts a figure up to its value, and animates again whenever it changes.
 * Driven by requestAnimationFrame rather than CSS because the thing changing
 * is text, which CSS cannot interpolate.
 *
 * Skipped entirely when the machine asks for reduced motion, or when the
 * figure is too small to read as counting (`< 2`) — and skipped *during
 * render*, not from the effect. Settling it in an effect would still paint one
 * frame of `0` first, which is precisely the flicker reduced motion is meant
 * to avoid.
 */
export function useCountUp(value) {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    const frameRef = useRef(0);
    // Read once: a till's motion preference does not change mid-shift, and
    // re-reading per render would make the return value non-deterministic.
    const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const instant = reduced || Math.abs(value) < 2;
    useEffect(() => {
        if (instant) {
            fromRef.current = value;
            return;
        }
        const from = fromRef.current;
        const start = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - start) / DURATION_MS, 1);
            setDisplay(Math.round(from + (value - from) * easeOut(progress)));
            if (progress < 1) {
                frameRef.current = requestAnimationFrame(tick);
            }
            else {
                fromRef.current = value;
            }
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value, instant]);
    return instant ? value : display;
}
