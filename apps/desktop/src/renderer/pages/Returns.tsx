import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, Undo2 } from 'lucide-react';
import type { Return, SaleDetail, SaleListItem } from '@pharmacy/shared-types';
import styles from './Returns.module.css';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { formatDate, formatMoney, formatTime } from '../lib/cx';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Returns() {
  const toast = useToast();
  const canSeeHistory = useAuth((s) => s.can('admin', 'pharmacist'));

  const [saleIdInput, setSaleIdInput] = useState('');
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Return[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [browseDate, setBrowseDate] = useState(() => isoDate(new Date()));
  const [browseSales, setBrowseSales] = useState<SaleListItem[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!canSeeHistory) return;
    try {
      setHistory(await api.returns());
    } catch (err) {
      toast.error('تعذّر تحميل سجل الإرجاعات', (err as Error).message);
    } finally {
      setLoadingHistory(false);
    }
  }, [canSeeHistory, toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadBrowseSales = useCallback(async () => {
    if (!canSeeHistory) return;
    setLoadingBrowse(true);
    try {
      setBrowseSales(await api.salesByDate(browseDate));
    } catch (err) {
      toast.error('تعذّر تحميل مبيعات هذا اليوم', (err as Error).message);
    } finally {
      setLoadingBrowse(false);
    }
  }, [canSeeHistory, browseDate, toast]);

  useEffect(() => {
    loadBrowseSales();
  }, [loadBrowseSales]);

  async function loadSale(id: number) {
    if (!id) return;
    setLooking(true);
    try {
      const found = await api.saleById(id);
      setSale(found);
      setQuantities({});
      setReason('');
    } catch (err) {
      setSale(null);
      toast.error('تعذّر إيجاد الفاتورة', (err as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function lookupSale(event?: FormEvent) {
    event?.preventDefault();
    await loadSale(Number(saleIdInput.trim()));
  }

  function selectBrowsedSale(id: number) {
    setSaleIdInput(String(id));
    loadSale(id);
  }

  function remainingOf(item: SaleDetail['items'][number]): number {
    return item.quantity - item.returnedQuantity;
  }

  function setQuantity(saleItemId: number, value: number, max: number) {
    setQuantities((prev) => ({ ...prev, [saleItemId]: Math.max(0, Math.min(value, max)) }));
  }

  const total = sale
    ? sale.items.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * item.unitPrice, 0)
    : 0;

  async function submitReturn() {
    if (!sale) return;
    const items = Object.entries(quantities)
      .map(([saleItemId, quantity]) => ({ saleItemId: Number(saleItemId), quantity }))
      .filter((line) => line.quantity > 0);

    if (items.length === 0) {
      toast.error('حدّد كمية إرجاع لصنف واحد على الأقل');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createReturn({ saleId: sale.id, items, reason: reason.trim() || null });
      toast.success('تم تنفيذ الإرجاع', `المبلغ المسترجَع ${formatMoney(created.total)} د.ع`);
      setSale(null);
      setSaleIdInput('');
      loadHistory();
    } catch (err) {
      toast.error('تعذّر تنفيذ الإرجاع', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <form className={styles.lookupRow} onSubmit={lookupSale}>
          <div className={styles.lookupInput}>
            <Input
              label="رقم الفاتورة"
              type="number"
              value={saleIdInput}
              onChange={(e) => setSaleIdInput(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={looking}>
            <Search size={16} />
            {looking ? 'جارٍ البحث…' : 'بحث'}
          </Button>
        </form>

        {canSeeHistory && !sale && (
          <div className={styles.browseSection}>
            <div className={styles.browseHeader}>
              <span className={styles.browseTitle}>أو تصفّح مبيعات يوم مُعيّن</span>
              <Input
                type="date"
                value={browseDate}
                onChange={(e) => setBrowseDate(e.target.value)}
                className={styles.browseDateInput}
              />
            </div>
            {loadingBrowse ? (
              <div className={styles.browseSkeleton}>
                <Skeleton height="2.75rem" radius="var(--radius-md)" />
                <Skeleton height="2.75rem" radius="var(--radius-md)" />
                <Skeleton height="2.75rem" radius="var(--radius-md)" />
              </div>
            ) : browseSales.length === 0 ? (
              <p className={styles.browseEmpty}>لا توجد مبيعات في هذا اليوم</p>
            ) : (
              <div className={styles.browseList}>
                {browseSales.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={styles.browseItem}
                    disabled={looking}
                    onClick={() => selectBrowsedSale(row.id)}
                  >
                    <span className={styles.name}>
                      فاتورة رقم {row.id} — {formatTime(row.date)}
                    </span>
                    <span className={styles.browseMeta}>
                      <span>{row.userName}</span>
                      <span>{row.items.length} صنف</span>
                      <span className="numeric">{formatMoney(row.total)} د.ع</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!sale ? (
          <div className={styles.empty}>أدخل رقم الفاتورة لعرض تفاصيلها وبدء الإرجاع</div>
        ) : (
          <>
            <div className={styles.saleInfo}>
              <span>فاتورة رقم {sale.id}</span>
              <span className={styles.saleInfoMeta}>
                {formatDate(sale.date)} — {sale.userName}
              </span>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>المُباع</th>
                  <th>مُرجع سابقاً</th>
                  <th>المتاح</th>
                  <th>كمية الإرجاع</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => {
                  const remaining = remainingOf(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.productName}
                        {item.isSubUnit && (
                          <span className={styles.unitBadge}>{item.unitLabel}</span>
                        )}
                      </td>
                      <td className="numeric">{item.quantity}</td>
                      <td className="numeric">{item.returnedQuantity}</td>
                      <td className="numeric">{remaining}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          className={styles.qtyInput}
                          value={quantities[item.id] ?? ''}
                          placeholder="0"
                          disabled={remaining === 0}
                          onChange={(e) => setQuantity(item.id, Number(e.target.value), remaining)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.footerBar}>
              <div className={styles.reasonField}>
                <Input
                  label="سبب الإرجاع (اختياري)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className={styles.totalBlock}>
                <div className={styles.grandTotal}>{formatMoney(total)} د.ع</div>
                <Button variant="danger" onClick={submitReturn} disabled={submitting || total === 0}>
                  <Undo2 size={16} />
                  {submitting ? 'جارٍ التنفيذ…' : 'تنفيذ الإرجاع'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {canSeeHistory && (
        <div className={styles.history}>
          <h2 className={styles.historyTitle}>آخر الإرجاعات</h2>
          {loadingHistory ? (
            <div className={styles.historySkeleton}>
              <Skeleton height="3.5rem" radius="var(--radius-md)" />
              <Skeleton height="3.5rem" radius="var(--radius-md)" />
              <Skeleton height="3.5rem" radius="var(--radius-md)" />
            </div>
          ) : history.length === 0 ? (
            <p className={styles.historyEmpty}>لا توجد إرجاعات بعد</p>
          ) : (
            history.map((r) => (
              <div key={r.id} className={styles.historyItem}>
                <div className={styles.name}>فاتورة رقم {r.saleId}</div>
                <div className={styles.historyMeta}>
                  <span>{formatDate(r.date)}</span>
                  <span className="numeric">{formatMoney(r.total)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
