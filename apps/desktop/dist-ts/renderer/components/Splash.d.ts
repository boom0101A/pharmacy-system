interface SplashProps {
    /** Called once the screen has finished fading out. */
    onFinish: () => void;
}
/**
 * The launch screen, shown once before the login form.
 *
 * It is purely cosmetic — it waits out a fixed duration rather than any real
 * startup work, so it must never gate anything the user needs. The two timers
 * check reduced-motion themselves: the global CSS override in tokens.css only
 * neutralises animations, it cannot shorten a setTimeout.
 */
export declare function Splash({ onFinish }: SplashProps): import("react").JSX.Element;
export {};
