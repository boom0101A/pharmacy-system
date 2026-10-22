import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, DollarSign, Receipt, Tags, X } from 'lucide-react';
import type { Category, DashboardSummary } from '@pharmacy/shared-types';
import styles from './Dashboard.module.css';
import { Button } from '../components/ui/Button';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { cx, formatMoney } from '../lib/cx';
import { useCountUp } from '../lib/useCountUp';
import { useAuth } from '../store/auth';
import { usePendingDeletes } from '../store/pendingDeletes';
import { useStockVersion } from '../store/stockSync';

export function Dashboard() {
  const toast = useToast();
  const { can } = useAuth();
  const canManageCategories = can('admin', 'pharmacist');
  // The server already zeroes these two figures for a cashier (see
  // maskSalesForRole), but showing a literal "0" would read as "no sales
  // today" — actively misleading rather than merely withheld.
  const canSeeSales = can('admin', 'pharmacist');
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  // Hidden while their undo window is open; deleted on the server only when it closes.
  const pendingCategoryIds = usePendingDeletes((s) => s.category);
  const hidePending = usePendingDeletes((s) => s.hide);
  const unhidePending = usePendingDeletes((s) => s.unhide);
  const unhideCategory = (id: number) => unhidePending('category', id);
  // Pending ones are already gone as far as the user is concerned — including
  // as a destination for another category's medicines.
  const liveCategories = categories.filter((c) => !pendingCategoryIds.has(c.id));

  function loadCategories() {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }

  // Only admin/pharmacist can act on this section (the server enforces the
  // same two roles on POST/DELETE) — no point fetching it for a cashier.
  useEffect(() => {
    if (!canManageCategories) return;
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCategories]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    setAddingCategory(true);
    try {
      await api.createCategory(name);
      setNewCategoryName('');
      loadCategories();
    } catch (err) {
      toast.error('تعذّر إضافة التصنيف', (err as Error).message);
    } finally {
      setAddingCategory(false);
    }
  }

  /** Deferred like product deletion: nothing reaches the server until the undo window closes. */
  function removeCategory(category: Category, moveTo: Category | null) {
    setDeletingCategory(null);
    hidePending('category', category.id);
    toast.undoable({
      title: `حُذف تصنيف «${category.name}»`,
      description: category.productCount
        ? moveTo
          ? `ونُقلت أدويته إلى «${moveTo.name}»`
          : 'وأصبحت أدويته بدون تصنيف'
        : 'يمكنك التراجع خلال ثوانٍ',
      onUndo: () => unhideCategory(category.id),
      onCommit: () => {
        api
          .deleteCategory(category.id, moveTo?.id)
          // Un-hidden only after the reload, or the chip flashes back for a moment.
          .then(() => api.categories().then(setCategories))
          .catch((err: Error) => toast.error('تعذّر حذف التصنيف', err.message))
          .finally(() => unhideCategory(category.id));
      },
    });
  }

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
        {canSeeSales && (
          <div className={cx(styles.stat, styles.statHero)}>
            <span className={styles.statIcon}>
              <DollarSign size={20} />
            </span>
            <div>
              <div className={cx(styles.statValue, 'numeric')}>{formatMoney(salesTotal)}</div>
              <div className={styles.statLabel}>مبيعات اليوم</div>
            </div>
          </div>
        )}

        {canSeeSales && (
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <Receipt size={20} />
            </span>
            <div>
              <div className={cx(styles.statValue, 'numeric')}>{salesCount}</div>
              <div className={styles.statLabel}>عدد الفواتير</div>
            </div>
          </div>
        )}

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

      {canManageCategories && (
        <section className={styles.categoriesCard}>
          <h2 className={styles.listTitle}>التصنيفات</h2>

          <form className={styles.categoryForm} onSubmit={addCategory}>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="اسم التصنيف الجديد"
              aria-label="اسم التصنيف الجديد"
            />
            <Button type="submit" disabled={addingCategory || !newCategoryName.trim()}>
              {addingCategory ? 'جارٍ الإضافة…' : 'إضافة'}
            </Button>
          </form>

          {liveCategories.length === 0 ? (
            <p className={styles.listEmpty}>لا توجد تصنيفات بعد</p>
          ) : (
            <ul className={styles.categoryChips}>
              {liveCategories.map((category) => (
                <li key={category.id} className={styles.categoryChip}>
                  <Tags size={13} />
                  <span>{category.name}</span>
                  {!!category.productCount && (
                    <span className={styles.categoryChipCount}>{category.productCount}</span>
                  )}
                  <button
                    type="button"
                    className={styles.categoryChipRemove}
                    onClick={() => setDeletingCategory(category)}
                    aria-label={`حذف ${category.name}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <DeleteCategoryDialog
        category={deletingCategory}
        categories={liveCategories}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={(moveTo) => deletingCategory && removeCategory(deletingCategory, moveTo)}
      />
    </div>
  );
}

