import { WifiOff } from 'lucide-react';
import styles from './ConnectionBanner.module.css';
import { useConnection } from '../store/connection';

interface Props {
  onRetry: () => void;
}

/** A dead server is worth saying even on the login screen — it's usually the real reason "the password isn't working". */
export function ConnectionBanner({ onRetry }: Props) {
  const online = useConnection((s) => s.online);
  if (online) return null;

  return (
    <div className={styles.banner} role="alert">
      <WifiOff size={16} />
      <span>تعذّر الاتصال بالخادم — تحقّق من الشبكة</span>
      <button type="button" className={styles.retry} onClick={onRetry}>
        إعادة المحاولة
      </button>
    </div>
  );
}
