import { Moon, Sun } from 'lucide-react';
import styles from './AppShell.module.css';
import { useAppearance } from '../lib/appearance';

/**
 * Light/dark switch in the top bar, for every user. The same per-machine
 * setting as the switch on the settings page (they share one store), so the
 * cashier at a dim counter can choose without needing the admin.
 */
export function ThemeToggle() {
  const { dark, setDark } = useAppearance();

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={() => setDark(!dark)}
      aria-label="تبديل الوضع الليلي"
      aria-pressed={dark}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
