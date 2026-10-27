import { useEffect, useState, type CSSProperties } from 'react';
import { Cross } from 'lucide-react';
import styles from './Splash.module.css';
import { cx } from '../lib/cx';

/** How long the scene plays, then how long its exit takes. */
const DWELL_MS = 2200;
const FADE_MS = 400;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface SplashProps {
  /** Called once the screen has finished its exit. */
  onFinish: () => void;
}

/**
 * The launch screen, shown once before the login form.
 *
 * A glass scene over the same moving backdrop (components/Backdrop) the login
 * screen sits on, so the handover is one continuous picture. Purely cosmetic:
 * it waits out a fixed time rather than any real startup work, and a click or
 * any key skips it — a cashier opening the till twice a day shouldn't have to
 * watch it. The timers check reduced-motion themselves: the global CSS
 * override only neutralises animations, it cannot shorten a setTimeout.
 */
export function Splash({ onFinish }: SplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), prefersReducedMotion() ? 0 : DWELL_MS);
    const skip = () => setLeaving(true);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onFinish, prefersReducedMotion() ? 0 : FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onFinish]);

  // The progress bar fills over exactly the dwell above, so the timing lives in
  // one place instead of drifting between the timer and the stylesheet.
  const timing = { '--splash-dwell': `${DWELL_MS}ms`, '--splash-exit': `${FADE_MS}ms` } as CSSProperties;

  return (
    <div
      className={cx(styles.page, leaving && styles.leaving)}
      style={timing}
      role="status"
      aria-label="جارٍ تشغيل نظام الصيدلية"
    >
      <span className={styles.veil} aria-hidden="true" />
      <span className={styles.glow} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.markWrap} aria-hidden="true">
          <span className={styles.ripple} />
          <span className={cx(styles.ripple, styles.rippleLate)} />
          {/* Sized for a real logo to replace the icon later without CSS changes. */}
          <span className={styles.mark}>
            <Cross size={44} strokeWidth={2.25} />
            <span className={styles.sheen} />
          </span>
        </div>

        <div className={styles.text}>
          <h1 className={styles.wordmark}>
            <span className={styles.word}>نظام</span>{' '}
            <span className={cx(styles.word, styles.wordLate)}>الصيدلية</span>
          </h1>
          <p className={styles.tagline}>إدارة المخزون والمبيعات</p>
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} />
        </div>
      </div>
    </div>
  );
}
