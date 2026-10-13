import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Batch, Product } from '@pharmacy/shared-types';
import styles from './Inventory.module.css';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { parsePriceInput } from '../lib/priceInput';
import { useAuth } from '../store/auth';

interface Props {
  /** Non-null opens the dialog for that product. */
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Local calendar date, not UTC — a plain day-level comparison has no business shifting a day at the UTC boundary. */
function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Receiving stock creates a batch, not a bare quantity bump — each intake keeps
 * its own expiry date so the till can sell earliest-expiring stock first.
 */
export function ReceiveStockDialog({ product, onClose, onSaved }: Props) {
  const toast = useToast();
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const canDeleteBatch = useAuth((s) => s.can('admin'));
  const [batches, setBatches] = useState<Batch[]>([]);
  const [savingBatchId, setSavingBatchId] = useState<number | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<Batch | null>(null);
  const [writingOff, setWritingOff] = useState(false);

  // A warning, not a block — a batch might genuinely be received already
  // expired (e.g. to log it before returning it to the supplier). The sale
  // side (sales.service.ts) is what actually refuses to sell an expired
  // batch; this is just a heads-up in case the date was a typo.
  const isPastExpiry = expiryDate !== '' && expiryDate < todayIsoDate();

  // The product the dialog is showing *now*. A late batches response for a
  // previously shown product is dropped — otherwise its rows (and their
  // write-off buttons) appeared under the new product's title.
  const shownProductId = useRef<number | null>(null);

  const loadBatches = useCallback(async (productId: number) => {
    try {
      const rows = await api.batches(productId);
      if (shownProductId.current === productId) setBatches(rows);
    } catch {
      if (shownProductId.current === productId) setBatches([]);
    }
  }, []);

  useEffect(() => {
    shownProductId.current = product?.id ?? null;
    if (product) {
      setBatches([]);
      setQuantity('');
      setExpiryDate('');
      setBatchNumber('');
      setPurchasePrice(String(product.purchasePrice));
      loadBatches(product.id);
    }
  }, [product, loadBatches]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    const parsedPrice = parsePriceInput(purchasePrice);
    if (parsedPrice === null) {
      toast.error('سعر الشراء غير صالح', 'اكتب رقماً فقط، مثل 1,500');
      return;
    }

    setSaving(true);
    try {
      await api.createBatch({
        productId: product.id,
        quantity: Number(quantity),
        expiryDate: expiryDate || null,
        batchNumber: batchNumber.trim() || null,
        purchasePrice: parsedPrice,
      });
      toast.success('تمت إضافة الكمية', `${quantity} ${product.unit} من "${product.name}"`);
      // The dialog stays open so the new batch shows up in the list below —
      // seeing it is the whole point: it explains why the table's "nearest
      // expiry" may still show an older batch's date.
      setQuantity('');
      setExpiryDate('');
      setBatchNumber('');
      loadBatches(product.id);
      onSaved();
    } catch (err) {
      toast.error('تعذّر إضافة الكمية', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBatchEdit(batch: Batch, expiry: string, number: string) {
    setSavingBatchId(batch.id);
    try {
      await api.updateBatch(batch.id, {
        expiryDate: expiry || null,
        batchNumber: number.trim() || null,
      });
      if (product) loadBatches(product.id);
      onSaved();
    } catch (err) {
      toast.error('تعذّر حفظ التعديل', (err as Error).message);
    } finally {
      setSavingBatchId(null);
    }
  }

  async function deleteBatch(batch: Batch) {
    if (deletingBatchId !== null) return;
    setDeletingBatchId(batch.id);
    try {
      await api.deleteBatch(batch.id);
      toast.success('تم حذف الدفعة', undefined, { kind: 'delete' });
      if (product) loadBatches(product.id);
      onSaved();
    } catch (err) {
      toast.error('تعذّر الحذف', (err as Error).message);
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function confirmWriteOff() {
    if (!writeOffTarget) return;
    setWritingOff(true);
    try {
      await api.writeOffBatch(writeOffTarget.id);
      toast.success('تم إتلاف الدفعة', `${writeOffTarget.quantity} ${product?.unit ?? ''}`, { kind: 'delete' });
      if (product) loadBatches(product.id);
      onSaved();
    } catch (err) {
      toast.error('تعذّر الإتلاف', (err as Error).message);
    } finally {
      setWritingOff(false);
      setWriteOffTarget(null);
    }
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={product ? `إدخال كمية — ${product.name}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
          <Button form="batch-form" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'إضافة'}
          </Button>
        </>
      }
    >
      <form id="batch-form" className={styles.formGrid} onSubmit={handleSubmit}>
        <Input
          label="الكمية"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
          required
          autoFocus
        />
        <Input
          label="تاريخ الانتهاء"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          error={isPastExpiry ? 'هذا تاريخ في الماضي — تأكد أنه صحيح' : undefined}
        />
        <Input
          label="رقم الدفعة"
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
        />
        <Input
          label="سعر الشراء"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
      </form>

      {batches.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            الدفعات الحالية
          </h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الكمية</th>
                <th>تاريخ الانتهاء</th>
                <th>رقم الدفعة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <BatchRow
                  key={batch.id}
                  batch={batch}
                  canDelete={canDeleteBatch}
                  saving={savingBatchId === batch.id}
                  deleting={deletingBatchId === batch.id}
                  onSave={(expiry, number) => saveBatchEdit(batch, expiry, number)}
                  onDelete={() => deleteBatch(batch)}
                  onWriteOff={() => setWriteOffTarget(batch)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={writeOffTarget !== null}
        onOpenChange={(open) => !open && setWriteOffTarget(null)}
        title="إتلاف الدفعة؟"
        description={
          writeOffTarget
            ? `سيُصفَّر رصيد هذه الدفعة (${writeOffTarget.quantity} ${product?.unit ?? ''}) بعد إخراجها فعلياً من الرف. لا يمكن التراجع.`
            : undefined
        }
        confirmLabel={writingOff ? 'جارٍ الإتلاف…' : 'نعم، أتلف الكمية'}
        onConfirm={confirmWriteOff}
      />
    </Dialog>
  );
}

/** Local calendar date string, matching todayIsoDate() above — a batch expiring today is still sellable and not yet write-off-eligible. */
function isExpired(expiryDate: string | null): boolean {
  return expiryDate !== null && expiryDate.slice(0, 10) < todayIsoDate();
}

function BatchRow({
  batch,
  canDelete,
  saving,
  deleting,
  onSave,
  onDelete,
  onWriteOff,
}: {
  batch: Batch;
  canDelete: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: (expiry: string, number: string) => void;
  onDelete: () => void;
  onWriteOff: () => void;
}) {
  const [expiry, setExpiry] = useState(batch.expiryDate ? batch.expiryDate.slice(0, 10) : '');
  const [number, setNumber] = useState(batch.batchNumber ?? '');
  const changed = expiry !== (batch.expiryDate ? batch.expiryDate.slice(0, 10) : '') || number !== (batch.batchNumber ?? '');

  return (
    <tr>
      <td className="numeric">{batch.quantity}</td>
      <td>
        <input type="date" aria-label="تاريخ انتهاء الدفعة" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </td>
      <td>
        <input aria-label="رقم الدفعة" value={number} onChange={(e) => setNumber(e.target.value)} />
      </td>
      <td>
        <div className={styles.actions}>
          {changed && (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(expiry, number)}>
              حفظ
            </Button>
          )}
          {batch.quantity > 0 && isExpired(batch.expiryDate) && (
            <Button variant="outline" size="sm" onClick={onWriteOff}>
              إتلاف
            </Button>
          )}
          {canDelete && batch.quantity === 0 && (
            <Button variant="outline" size="sm" disabled={deleting} onClick={onDelete} aria-label="حذف الدفعة">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
