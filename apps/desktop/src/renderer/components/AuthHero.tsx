import { Cross } from 'lucide-react';
import styles from './AuthHero.module.css';
import { useBranding } from '../store/branding';

/**
 * The introduction half of the sign-in screens (login, first password change,
 * activation), in the design file's split layout. Only the pharmacy's own
 * logo and the app's name — no marketing copy. Decorative: the card beside it
 * carries the real heading, so this is hidden from screen readers.
 */
export function AuthHero() {
  const logoUrl = useBranding((s) => s.logoUrl);

  return (
    <div className={styles.hero} aria-hidden="true">
      {logoUrl ? (
        <img src={logoUrl} alt="" className={styles.logo} />
      ) : (
        <span className={styles.mark}>
          <Cross size={30} />
        </span>
      )}
      <p className={styles.headline}>
        نظام <span className={styles.gradient}>الصيدلية</span>
      </p>
      <p className={styles.tagline}>إدارة المخزون والمبيعات</p>
    </div>
  );
}
