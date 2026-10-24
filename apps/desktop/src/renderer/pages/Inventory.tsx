import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Product } from '@pharmacy/shared-types';
import styles from './Inventory.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { ProductDialog } from './ProductDialog';
import { ReceiveStockDialog } from './ReceiveStockDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useStockVersion } from '../store/stockSync';
import { usePendingDeletes } from '../store/pendingDeletes';
import { useToast } from '../components/ui/Toast';
import { cx, formatDate, formatMoney } from '../lib/cx';

const PAGE_SIZE = 40;
const LOW_STOCK_ALERT_MS = 8000;

type StatusFilter = 'all' | 'low' | 'expiring' | 'out' | 'archived';

export function Inventory() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can('admin', 'pharmacist');
  const canDelete = can('admin', 'pharmacist');
  const stockVersion = useStockVersion((s) => s.version);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [counts, setCounts] = useState({ total: 0, low: 0, expiring: 0, out: 0 });
  const [editing, setEditing] = useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [receivingFor, setReceivingFor] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  // Hidden while their undo window is open; deleted on the server only when it closes.
  const pendingDeleteIds = usePendingDeletes((s) => s.product);
  const hidePending = usePendingDeletes((s) => s.hide);
  const unhidePending = usePendingDeletes((s) => s.unhide);
  // The low-stock banner greets you on arrival and then gets out of the way.
  const [lowStockAlertDone, setLowStockAlertDone] = useState(false);

  // Bumped by every fresh load, so a response for an older search/filter —
  // including a "load more" page — is dropped instead of mixed into the list.
  const loadGeneration = useRef(0);

  const load = useCallback(
    async (term: string, status: StatusFilter) => {
      const generation = ++loadGeneration.current;
      try {
        const query = term.trim() || undefined;
        const [page, stats] = await Promise.all([
          api.products(query, {
            status: status === 'all' ? undefined : status,
            limit: PAGE_SIZE,
          }),
          api.productStats(query),
        ]);
        if (generation !== loadGeneration.current) return;
        setProducts(page);
        setCounts(stats);
      } catch (err) {
        toast.error('تعذّر تحميل المخزون', (err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(search, statusFilter), 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, load, stockVersion]);

  useEffect(() => {
    // The banner's fade is CSS, but what removes it is this timer — and a
    // timer is something the global reduced-motion override in tokens.css
    // cannot reach. Without this check the banner would sit there, frozen
    // mid-animation, for the full eight seconds.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => setLowStockAlertDone(true),
      reduced ? 0 : LOW_STOCK_ALERT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  async function loadMore() {
    const generation = loadGeneration.current;
    setLoadingMore(true);
    try {
      const more = await api.products(search.trim() || undefined, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: products.length,
      });
      if (generation !== loadGeneration.current) return;
      setProducts((prev) => [...prev, ...more]);
    } catch (err) {
      toast.error('تعذّر تحميل المزيد', (err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Lets the dashboard's stat cards deep-link straight into a filtered view.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get('filter');
    if (requested === 'low' || requested === 'expiring' || requested === 'out') {
      setStatusFilter(requested);
    }
  }, [searchParams]);

  /**
   * F1 opens the new-medicine form, the same as the button. Held back while any
   * dialog is already up: it would stack a second one over an edit in progress
   * and throw away whatever had been typed into it.
   */
  useEffect(() => {
    if (!canEdit) return;
    const busy = productDialogOpen || receivingFor !== null || deletingProduct !== null;
    if (busy) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'F1') return;
      event.preventDefault();
      setEditing(null);
      setProductDialogOpen(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, productDialogOpen, receivingFor, deletingProduct]);

  const STAT_TILES = [
    { key: 'all', label: 'الكل', count: counts.total },
    { key: 'low', label: 'منخفض', count: counts.low },
    { key: 'expiring', label: 'قارب الانتهاء', count: counts.expiring },
    { key: 'out', label: 'نفد', count: counts.out },
  ] as const;

  const visible = useMemo(() => products.filter((p) => !pendingDeleteIds.has(p.id)), [products, pendingDeleteIds]);

  /**
   * Built only when the rows themselves change, not on every keystroke in the
   * search box above — "load more" appends without any upper bound, so by late
   * in a shift this table can be long enough for that to matter.
   *
   * Safe to leave the handlers out of the dependency list: everything they
   * close over is either the row's own product or a `useState` setter, whose
   * identity React guarantees is stable.
   */
  const rows = useMemo(
    () =>
      visible.map((product) => {
        const rowTone =
          product.stock <= 0
            ? styles.rowDanger
            : product.stock <= product.reorderLevel
              ? styles.rowWarn
              : styles.rowBrand;
        return (
          <tr key={product.id} className={rowTone}>
            <td className={styles.name}>
              {product.name}
              {product.barcode && <div className={styles.barcode}>{product.barcode}</div>}
            </td>
            <td>{product.categoryName ?? '—'}</td>
            <td className="numeric">{product.stock}</td>
            <td className="numeric">{formatMoney(product.salePrice)}</td>
            <td>
              {product.stock <= 0 ? (
                <Badge tone="danger" pulse>
                  نفد
                </Badge>
              ) : product.stock <= product.reorderLevel ? (
                <Badge tone="warning">يحتاج إعادة طلب</Badge>
              ) : (
                <Badge tone="success">متوفر</Badge>
              )}
            </td>
            <td>{formatDate(product.nearestExpiry)}</td>
            <td>
              <div className={styles.actions}>
                {statusFilter === 'archived' && canEdit && (
                  <Button variant="outline" size="sm" onClick={() => void restore(product)}>
                    <ArchiveRestore size={15} />
                    استرجاع
                  </Button>
                )}
                {statusFilter !== 'archived' && canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setReceivingFor(product)}>
                    إدخال كمية
                  </Button>
                )}
                {statusFilter !== 'archived' && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(product);
                      setProductDialogOpen(true);
                    }}
                    aria-label={`تعديل ${product.name}`}
                  >
                    <Pencil size={15} />
                  </Button>
                )}
                {statusFilter !== 'archived' && canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingProduct(product)}
                    aria-label={`حذف ${product.name}`}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </td>
          </tr>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, canEdit, canDelete, statusFilter],
  );
  const shownCount =
    statusFilter === 'all' ? counts.total : statusFilter === 'archived' ? visible.length : counts[statusFilter];

  const unhide = (id: number) => unhidePending('product', id);

  /**
   * Deferred: the row disappears now, but the server only hears about it once
   * the undo window closes — a real delete cannot be taken back afterwards.
   */
  function remove(product: Product) {
    setDeletingProduct(null);
    hidePending('product', product.id);
    toast.undoable({
      title: `حُذف «${product.name}»`,
      description: 'يمكنك التراجع خلال ثوانٍ',
      onUndo: () => unhide(product.id),
      onCommit: () => {
        api
          .deleteProduct(product.id)
          .then(async ({ archived }) => {
            if (archived) {
              toast.success('تمت أرشفة الصنف', 'له فواتير سابقة فبقيت كما هي — يمكن استرجاعه من «المؤرشفة»', {
                silent: true,
              });
            }
            // Un-hidden only after the reload, or the row flashes back for a moment.
            await load(search, statusFilter);
          })
          .catch((err: Error) => toast.error('تعذّر الحذف', err.message))
          .finally(() => unhide(product.id));
      },
    });
  }

  async function restore(product: Product) {
    try {
      await api.restoreProduct(product.id);
      toast.success('تم استرجاع الصنف', product.name);
      load(search, statusFilter);
    } catch (err) {
      toast.error('تعذّر الاسترجاع', (err as Error).message);
    }
  }

  return (
    <>
      {!lowStockAlertDone && counts.low > 0 && (
        <div className={styles.lowStockBanner}>
          {counts.low} صنف يحتاج إعادة طلب
          <button type="button" onClick={() => setLowStockAlertDone(true)} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}

      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>المخزون</h2>
            <p className={styles.pageCount}>
              <span className="numeric">{shownCount}</span> صنف
            </p>
          </div>
          {canEdit && (
            <div className={styles.headerActions}>
              <Button
                variant={statusFilter === 'archived' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
              >
                <Archive size={16} />
                {statusFilter === 'archived' ? 'العودة إلى كل الأصناف' : 'الأصناف المؤرشفة'}
              </Button>
              <Button
                size="lg"
                className={styles.addButton}
                onClick={() => {
                  setEditing(null);
                  setProductDialogOpen(true);
                }}
              >
                <Plus size={18} />
                دواء جديد
                <kbd className={styles.keyHint} aria-hidden="true">
                  F1
                </kbd>
              </Button>
            </div>
          )}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود…"
              aria-label="بحث في المخزون"
            />
          </div>
          <div className={styles.chips} role="group" aria-label="تصفية المخزون">
            {STAT_TILES.map((tile) => {
              const active = tile.key === statusFilter;
              return (
                <button
                  key={tile.key}
                  type="button"
                  className={cx(styles.chip, active && styles.chipActive)}
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tile.key)}
                >
                  {tile.label}
                  <span className={cx(styles.chipCount, 'numeric')}>{tile.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.card}>
          {loading ? (
            <table className={styles.table}>
              <tbody>
                <SkeletonRows rows={6} columns={6} />
              </tbody>
            </table>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Package size={26} />}
              title="لا توجد أدوية"
              description={search ? 'لا نتائج مطابقة لبحثك' : 'ابدأ بإضافة أول دواء للمخزون'}
              action={
                search ? (
                  <Button variant="outline" onClick={() => setSearch('')}>
                    مسح البحث
                  </Button>
                ) : statusFilter !== 'all' ? (
                  <Button variant="outline" onClick={() => setStatusFilter('all')}>
                    عرض كل الأدوية
                  </Button>
                ) : (
                  canEdit && (
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setProductDialogOpen(true);
                      }}
                    >
                      <Plus size={16} />
                      دواء جديد
                    </Button>
                  )
                )
              }
            />
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>الأدوية</th>
                    <th>التصنيف</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>الحالة</th>
                    <th>أقرب انتهاء</th>
                    <th />
                  </tr>
                </thead>
                <tbody key={`${statusFilter}:${search}`} className={styles.tbodyFade}>
                  {rows}
                </tbody>
              </table>
            </div>
          )}

          {!loading && visible.length > 0 && visible.length < shownCount && (
            <div className={styles.loadMoreRow}>
              <span className={styles.shownCount}>
                عرض {visible.length} من {shownCount}
              </span>
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'جارٍ التحميل…' : 'تحميل المزيد'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ProductDialog
        open={productDialogOpen}
        product={editing}
        onOpenChange={setProductDialogOpen}
        onSaved={() => load(search, statusFilter)}
      />

      <ReceiveStockDialog
        product={receivingFor}
        onClose={() => setReceivingFor(null)}
        onSaved={() => load(search, statusFilter)}
      />

      <ConfirmDialog
        open={deletingProduct !== null}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        title={`حذف "${deletingProduct?.name ?? ''}"؟`}
        description={
          'إن كان للدواء فواتير بيع أو شراء سابقة فسيُؤرشف: يختفي من المخزون والبيع، وتبقى فواتيره وتقاريره كما هي، ويمكن استرجاعه من «المؤرشفة». وإن لم تكن له فواتير فسيُحذف نهائياً.' +
          (deletingProduct && deletingProduct.stock > 0
            ? ` المخزون المتبقي (${deletingProduct.stock} ${deletingProduct.unit}) لن يُباع.`
            : '')
        }
        onConfirm={() => deletingProduct && remove(deletingProduct)}
      />
    </>
  );
}
