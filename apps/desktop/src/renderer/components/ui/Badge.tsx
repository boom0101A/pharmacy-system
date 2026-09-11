import type { ReactNode } from 'react';
import styles from './Badge.module.css';
import { cx } from '../../lib/cx';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  tone?: BadgeTone;
  /**
   * A slow breathing pulse, for the row a pharmacist is scanning a long table
   * to find. Opt-in rather than automatic on `danger`: a table where every red
   * badge pulses is a table where none of them stands out.
   */
  pulse?: boolean;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', pulse, children }: BadgeProps) {
  return <span className={cx(styles.badge, styles[tone], pulse && styles.pulse)}>{children}</span>;
}
