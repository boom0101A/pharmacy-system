import { useEffect, useState } from 'react';
import styles from './AppShell.module.css';

// Iraqi Arabic (تشرين الأول, not أكتوبر) with Latin digits, as elsewhere.
const TIME = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * The top bar's clock. No seconds are shown, so it re-renders once a minute,
 * timed to land on the minute itself rather than up to 59 seconds late.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const current = new Date();
      const untilNextMinute = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextMinute);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.clock}>
      <b className="numeric">{TIME.format(now)}</b>
      <span>{DATE.format(now)}</span>
    </div>
  );
}
