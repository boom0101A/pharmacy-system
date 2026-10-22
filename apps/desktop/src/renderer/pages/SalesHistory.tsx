import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ReceiptText, Search, Undo2 } from 'lucide-react';
import type { SaleDetail, SalesHistoryRow } from '@pharmacy/shared-types';
import styles from './SalesHistory.module.css';
import dataPage from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { baghdadToday, cleanIpcError, cx, digitsOnly, formatDate, formatMoney, formatTime } from '../lib/cx';
import { RANGE_PRESETS, presetRange, type RangePreset } from '../lib/presetRange';

const PAGE_SIZE = 50;

/** Review past invoices over any period — read-only, apart from reprinting and starting a return. */
export function SalesHistory() {
  const toast = useToast();
  const navigate = useNavigate();
  const initial = presetRange('today', baghdadToday());
  const [range, setRange] = useState(initial);
  const [preset, setPreset] = useState<RangePreset | null>('today');
  const [q, setQ] = useState('');
  const [searched, setSearched] = useState('');
  const [rows, setRows] = useState<SalesHistoryRow[]>([]);
  const [count, setCount] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<SaleDetail | null>(null);
  const [printing, setPrinting] = useState(false);
  // A newer period/search must not be overwritten by a slower, older answer.
  const requestId = useRef(0);

  const load = useCallback(
    (offset: number) => {
      const id = ++requestId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      api
        .salesHistory({ from: range.from, to: range.to, q: searched || undefined, limit: PAGE_SIZE, offset })
        .then((page) => {
          if (id !== requestId.current) return;
          setRows((prev) => (offset === 0 ? page.rows : [...prev, ...page.rows]));
          setCount(page.count);
          setSum(page.sum);
        })
        .catch((err: Error) => id === requestId.current && toast.error('تعذّر تحميل الفواتير', err.message))
        .finally(() => {
          if (id !== requestId.current) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [range, searched, toast],
  );

  useEffect(() => load(0), [load]);

  function choosePreset(key: RangePreset) {
    setPreset(key);
    setRange(presetRange(key, baghdadToday()));
  }

  function setCustom(part: 'from' | 'to', value: string) {
    if (!value) return;
    setPreset(null);
    setRange((r) => ({ ...r, [part]: value }));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearched(q);
  }

  async function openSale(id: number) {
    try {
      setOpen(await api.saleById(id));
    } catch (err) {
      toast.error('تعذّر فتح الفاتورة', (err as Error).message);
    }
  }

  async function reprint(sale: SaleDetail) {
    setPrinting(true);
    try {
      await window.pharmacy.printReceipt({
        saleId: sale.id,
        date: sale.date,
        cashierName: sale.userName ?? '',
        items: sale.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unitLabel: i.unitLabel,
        })),
        discount: sale.discount,
        total: sale.total,
      });
      toast.success('أُرسلت الفاتورة للطباعة');
    } catch (err) {
      toast.error('تعذّرت الطباعة', cleanIpcError((err as Error).message));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.filters}>
        <div className={styles.presets} role="group" aria-label="الفترة">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={cx(styles.preset, preset === p.key && styles.presetActive)}
              aria-pressed={preset === p.key}
              onClick={() => choosePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          <Input label="من" type="date" value={range.from} onChange={(e) => setCustom('from', e.target.value)} />
          <Input label="إلى" type="date" value={range.to} onChange={(e) => setCustom('to', e.target.value)} />
          <form className={styles.search} onSubmit={submitSearch}>
            <Input
              label="رقم الفاتورة"
              inputMode="numeric"
              dir="ltr"
              value={q}
              onChange={(e) => setQ(digitsOnly(e.target.value))}
              placeholder="اختياري"
            />
            <Button type="submit" variant="outline">
              <Search size={16} />
              بحث
            </Button>
          </form>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={cx(styles.summaryValue, 'numeric')}>{count}</span>
          <span className={styles.summaryLabel}>عدد الفواتير</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={cx(styles.summaryValue, 'numeric')}>{formatMoney(sum)}</span>
          <span className={styles.summaryLabel}>مجموع الفترة (د.ع)</span>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<ReceiptText size={28} />} title="لا توجد فواتير في هذه الفترة" />
      ) : (
        <div className={dataPage.tableWrap}>
          <table className={dataPage.table}>
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th>التاريخ</th>
                <th>الكاشير</th>
                <th>الأصناف</th>
                <th>الخصم</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={styles.row} onClick={() => void openSale(r.id)}>
                  <td className={dataPage.name}>
                    فاتورة {r.id}
                    {r.returnedTotal > 0 && (
                      <span className={styles.returned}>مُرجع منها {formatMoney(r.returnedTotal)}</span>
                    )}
                  </td>
                  <td>
                    {formatDate(r.date)} — {formatTime(r.date)}
                  </td>
                  <td>{r.userName}</td>
                  <td className="numeric">{r.itemCount}</td>
                  <td className="numeric">{r.discount ? formatMoney(r.discount) : '—'}</td>
                  <td className="numeric">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length < count && (
        <div className={styles.more}>
          <Button variant="outline" disabled={loadingMore} onClick={() => load(rows.length)}>
            {loadingMore ? 'جارٍ التحميل…' : `عرض المزيد (${count - rows.length} متبقية)`}
          </Button>
        </div>
      )}

      <Dialog
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `فاتورة رقم ${open.id}` : ''}
        description={open ? `${formatDate(open.date)} — ${formatTime(open.date)} — ${open.userName ?? ''}` : undefined}
        footer={
          open && (
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                إغلاق
              </Button>
              <Button variant="outline" onClick={() => navigate(`/returns?sale=${open.id}`)}>
                <Undo2 size={16} />
                إرجاع من هذه الفاتورة
              </Button>
              <Button disabled={printing} onClick={() => void reprint(open)}>
                <Printer size={16} />
                {printing ? 'جارٍ الطباعة…' : 'إعادة طباعة'}
              </Button>
            </>
          )
        }
      >
        {open && (
          <>
            <table className={dataPage.table}>
              <thead>
                <tr>
                  <th>الدواء</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>المجموع</th>
                  <th>المُرجع</th>
                </tr>
              </thead>
              <tbody>
                {open.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productName}</td>
                    <td className="numeric">
                      {i.quantity} {i.unitLabel}
                    </td>
                    <td className="numeric">{formatMoney(i.unitPrice)}</td>
                    <td className="numeric">{formatMoney(i.quantity * i.unitPrice)}</td>
                    <td className="numeric">{i.returnedQuantity || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.totals}>
              {open.discount > 0 && (
                <span>
                  الخصم: <span className="numeric">{formatMoney(open.discount)}</span>
                </span>
              )}
              <strong>
                الإجمالي: <span className="numeric">{formatMoney(open.total)}</span> د.ع
              </strong>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
