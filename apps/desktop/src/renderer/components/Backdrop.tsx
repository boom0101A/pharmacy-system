import { useEffect, useState } from 'react';
import styles from './Backdrop.module.css';

/**
 * The ambient "liquid" backdrop: four blurred blobs drifting behind every
 * screen. Purely decorative — aria-hidden, pointer-events none, z-index below
 * everything. Drawn once at the app root so navigation never restarts it.
 *
 * Kept cheap: each blob is blurred once and then only *moved* (transform,
 * on the compositor), the drift pauses while the window is minimised or
 * hidden, and performance mode / reduced motion switch it off entirely.
 */
export function Backdrop() {
  const [paused, setPaused] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div className={styles.backdrop} aria-hidden="true" data-paused={paused ? 'true' : undefined}>
      <span className={`${styles.blob} ${styles.b1}`} />
      <span className={`${styles.blob} ${styles.b2}`} />
      <span className={`${styles.blob} ${styles.b3}`} />
      <span className={`${styles.blob} ${styles.b4}`} />
    </div>
  );
}
