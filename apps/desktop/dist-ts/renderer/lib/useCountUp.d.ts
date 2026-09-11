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
export declare function useCountUp(value: number): number;
