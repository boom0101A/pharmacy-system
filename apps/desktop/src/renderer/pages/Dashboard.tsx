import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, DollarSign, Receipt } from 'lucide-react';
import type { DashboardSummary } from '@pharmacy/shared-types';
import styles from './Dashboard.module.css';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { cx, formatMoney } from '../lib/cx';
import { useCountUp } from '../lib/useCountUp';
import { useStockVersion } from '../store/stockSync';

export function Dashboard() {
  const toast = useToast();
  const stockVersion = useStockVersion((s) => s.version);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Above the early return below: hooks can't sit behind a conditional, and
  // both settle on the real figure the moment the summary lands.
  const salesTotal = useCountUp(summary?.todaySalesTotal ?? 0);
  const salesCount = useCountUp(summary?.todaySalesCount ?? 0);

  useEffect(() => {
    api
      .dashboard()
      .then(setSummary)
      .catch((err: Error) => toast.error('تعذّر تحميل لوحة التحكم', err.message))
      .finally(() => setLoading(false));
  }, [toast, stockVersion]);

  if (loading || !summary) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height="7rem" radius="var(--radius-lg)" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.grid}>
        <div className={cx(styles.stat, styles.statHero)}>
          <span className={styles.statIcon}>
            <DollarSign size={20} />
          </span>
          <div>
            <div className={cx(styles.statValue, 'numeric')}>{formatMoney(salesTotal)}</div>
            <div className={styles.statLabel}>مبيعات اليوم</div>
          </div>
        </div>

        <div className={styles.stat}>
          <span className={styles.statIcon}>
            <Receipt size={20} />
          </span>
          <div>
            <div className={cx(styles.statValue, 'numeric')}>{salesCount}</div>
            <div className={styles.statLabel}>عدد الفواتير</div>
          </div>
        </div>

        <Link to="/inventory?filter=low" className={styles.stat}>
          <span className={styles.statIcon}>
            <AlertTriangle size={20} />
          </span>
          <div>
            <div className={cx(styles.statValue, 'numeric')}>{summary.lowStockCount}</div>
            <div className={styles.statLabel}>أصناف منخفضة المخزون</div>
          </div>
        </Link>

        <Link to="/inventory?filter=expiring" className={styles.stat}>
          <span className={styles.statIcon}>
            <Clock size={20} />
          </span>
          <div>
            <div className={cx(styles.statValue, 'numeric')}>{summary.expiringSoonCount}</div>
            <div className={styles.statLabel}>قاربت على الانتهاء</div>
          </div>
        </Link>
      </div>

      <div className={styles.lists}>
        <section className={styles.listCard}>
          <h2 className={styles.listTitle}>الأكثر احتياجاً لإعادة الطلب</h2>
          {summary.lowStock.length === 0 ? (
            <p className={styles.listEmpty}>لا توجد أصناف منخفضة حالياً</p>
          ) : (
            <ul className={styles.list}>
              {summary.lowStock.map((row) => (
                <li key={row.id}>
                  <span>{row.name}</span>
                  <span className="numeric">{row.value} متبقٍ</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.listCard}>
          <h2 className={styles.listTitle}>الأقرب انتهاءً</h2>
          {summary.expiringSoon.length === 0 ? (
            <p className={styles.listEmpty}>لا توجد دفعات قاربت على الانتهاء</p>
          ) : (
            <ul className={styles.list}>
              {summary.expiringSoon.map((row) => (
                <li key={row.id}>
                  <span>{row.name}</span>
                  <span className="numeric">{row.value} يوم</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

