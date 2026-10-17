import { CalendarClock } from 'lucide-react';
import styles from './ConnectionBanner.module.css';
import { LICENSE_WARNING_DAYS, licenseDaysLeft } from '../lib/licenseDays';

/** A trial running out should never be a surprise on the morning it stops opening. */
export function LicenseExpiryBanner({ expiresAt }: { expiresAt: string | null }) {
  const days = licenseDaysLeft(expiresAt);
  if (days === null || days > LICENSE_WARNING_DAYS) return null;

  return (
    <div className={styles.banner} role="status">
      <CalendarClock size={16} />
      <span>
        تنتهي صلاحية الترخيص بعد {days} يوم — اطلب مفتاحاً جديداً وأدخله من الإعدادات
      </span>
    </div>
  );
}
