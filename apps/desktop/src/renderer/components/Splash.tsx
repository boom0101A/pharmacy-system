import { useEffect, useState, type CSSProperties } from 'react';
import { Cross } from 'lucide-react';
import styles from './Splash.module.css';
import { cx } from '../lib/cx';

/** How long the screen stays up, then how long it takes to fade away. */
const DWELL_MS = 1300;
const FADE_MS = 320;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
export function Splash({ onFinish }: SplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setLeaving(true),
      prefersReducedMotion() ? 0 : DWELL_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onFinish, prefersReducedMotion() ? 0 : FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onFinish]);

  // The progress bar fills over exactly the dwell above, so the timing lives in
  // one place instead of drifting between the timer and the stylesheet.
  const timing = { '--splash-dwell': `${DWELL_MS}ms` } as CSSProperties;

  return (
    <div className={cx(styles.page, leaving && styles.leaving)} style={timing}>
      <div className={styles.inner}>
        {/* Sized for a real logo to replace the icon later without CSS changes. */}
        <span className={styles.mark}>
          <Cross size={44} strokeWidth={2.25} />
        </span>

        <div className={styles.text}>
          <h1 className={styles.wordmark}>نظام الصيدلية</h1>
          <p className={styles.tagline}>إدارة المخزون والمبيعات</p>
        </div>

        <div className={styles.progress}>
          <span className={styles.progressFill} />
        </div>
      </div>
    </div>
  );
}
