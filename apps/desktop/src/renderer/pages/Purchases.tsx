import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { Product, Purchase, PurchaseLineInput, Supplier } from '@pharmacy/shared-types';
import styles from './Purchases.module.css';
import dataPageStyles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { ProductPicker } from '../components/ui/ProductPicker';
import { NumberCellInput } from '../components/ui/NumberCellInput';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { formatDate, formatMoney } from '../lib/cx';
import { findInvalidPurchaseLine } from '../lib/purchaseValidation.js';
import { suggestedReorderQuantity } from '../lib/reorder.js';

interface DraftLine extends PurchaseLineInput {
  key: number;
  productName: string;
}

let nextKey = 1;

export function Purchases() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  useEffect(() => {
    api
      .suppliers()
      .then(setSuppliers)
      .catch((err: Error) => {
        setSuppliers([]);
        toast.error('تعذّر تحميل الموردين', err.message);
      });
    loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React (in development, under StrictMode) invokes a mount effect twice for
  // one commit — without this guard, both invocations would see the same
  // still-unconsumed router state and prefill the lines (and raise the
  // toast) twice. A ref survives that double-invoke since only the effect
  // re-runs, not the component's own state/refs.
  const reorderHandledRef = useRef(false);

  useEffect(() => {
    if (reorderHandledRef.current) return;
    const reorderProducts = (location.state as { reorderProducts?: Product[] } | null)
      ?.reorderProducts;
    if (!reorderProducts || reorderProducts.length === 0) return;
    reorderHandledRef.current = true;

    setLines(
      reorderProducts.map((product) => ({
        key: nextKey++,
        productId: product.id,
        productName: product.name,
        quantity: suggestedReorderQuantity(product.reorderLevel, product.stock),
        unitPrice: product.purchasePrice,
        batchNumber: null,
        expiryDate: null,
      })),
    );
    toast.success(`أُضيف ${reorderProducts.length} صنف من المخزون المنخفض`);
    // Clears the router state so navigating back to this page later (browser
    // back/forward, or a plain link) never silently replays the same prefill.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadPurchases() {
    setLoadingPurchases(true);
    api
      .purchases()
      .then(setPurchases)
      .catch((err: Error) => toast.error('تعذّر تحميل المشتريات', err.message))
      .finally(() => setLoadingPurchases(false));
  }

  function addProduct(product: Product) {
    if (lines.some((l) => l.productId === product.id)) return;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey++,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.purchasePrice,
        batchNumber: null,
        expiryDate: null,
      },
    ]);
  }

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  async function submit() {
    if (!supplierId) return toast.error('اختر المورّد أولاً');
    if (lines.length === 0) return toast.error('أضف صنفاً واحداً على الأقل');
    const invalidLineMessage = findInvalidPurchaseLine(lines);
    if (invalidLineMessage) return toast.error(invalidLineMessage);

    setSaving(true);
    try {
      await api.createPurchase({
        supplierId: Number(supplierId),
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
        })),
      });
      toast.success('تم تسجيل فاتورة الشراء واستلام الكمية');
      setLines([]);
      setSupplierId('');
      loadPurchases();
    } catch (err) {
      toast.error('تعذّر حفظ الفاتورة', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <div className={styles.formRow}>
          <div className={dataPageStyles.field}>
            <label className={dataPageStyles.label} htmlFor="purchase-supplier">
              المورّد
            </label>
            <select
              id="purchase-supplier"
              className={dataPageStyles.select}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">اختر مورّداً</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.picker}>
            <ProductPicker onSelect={addProduct} placeholder="أضف صنفاً للفاتورة…" />
          </div>
        </div>

        {lines.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>سعر الشراء</th>
                <th>رقم الدفعة</th>
                <th>تاريخ الانتهاء</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>{line.productName}</td>
                  <td>
                    <NumberCellInput
                      min={1}
                      aria-label={`كمية `}
                      className={styles.cellInput}
                      value={line.quantity}
                      onCommit={(quantity) => updateLine(line.key, { quantity })}
                    />
                  </td>
                  <td>
                    <NumberCellInput
                      min={0}
                      aria-label={`سعر شراء `}
                      className={styles.cellInput}
                      value={line.unitPrice}
                      onCommit={(unitPrice) => updateLine(line.key, { unitPrice })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`رقم دفعة `}
                      className={styles.cellInput}
                      value={line.batchNumber ?? ''}
                      onChange={(e) => updateLine(line.key, { batchNumber: e.target.value || null })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`تاريخ انتهاء `}
                      className={styles.cellInput}
                      value={line.expiryDate?.slice(0, 10) ?? ''}
                      onChange={(e) => updateLine(line.key, { expiryDate: e.target.value || null })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.removeLine}
                      onClick={() => removeLine(line.key)}
                      aria-label={`حذف `}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.footerBar}>
          <span className={styles.total}>الإجمالي: {formatMoney(total)} د.ع</span>
          <Button onClick={submit} disabled={saving || lines.length === 0}>
            <Plus size={16} />
            {saving ? 'جارٍ الحفظ…' : 'حفظ الفاتورة واستلام الكمية'}
          </Button>
        </div>
      </div>

      <div className={dataPageStyles.tableWrap}>
        {loadingPurchases ? (
          <table className={dataPageStyles.table}>
            <tbody>
              <SkeletonRows rows={3} columns={4} />
            </tbody>
          </table>
        ) : purchases.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={26} />} title="لا توجد فواتير شراء بعد" />
        ) : (
          <table className={dataPageStyles.table}>
            <thead>
              <tr>
                <th>المورّد</th>
                <th>التاريخ</th>
                <th>عدد الأصناف</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className={dataPageStyles.name}>{p.supplierName}</td>
                  <td>{formatDate(p.date)}</td>
                  <td className="numeric">{p.items.length}</td>
                  <td className="numeric">{formatMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
