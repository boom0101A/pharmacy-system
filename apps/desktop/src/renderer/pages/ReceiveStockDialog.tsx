import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Batch, Product } from '@pharmacy/shared-types';
import styles from './Inventory.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

interface Props {
  /** Non-null opens the dialog for that product. */
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
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

  const loadBatches = useCallback(async (productId: number) => {
    try {
      setBatches(await api.batches(productId));
    } catch {
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    if (product) {
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

    setSaving(true);
    try {
      await api.createBatch({
        productId: product.id,
        quantity: Number(quantity),
        expiryDate: expiryDate || null,
        batchNumber: batchNumber.trim() || null,
        purchasePrice: Number(purchasePrice) || 0,
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
    try {
      await api.deleteBatch(batch.id);
      toast.success('تم حذف الدفعة');
      if (product) loadBatches(product.id);
      onSaved();
    } catch (err) {
      toast.error('تعذّر الحذف', (err as Error).message);
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
                  onSave={(expiry, number) => saveBatchEdit(batch, expiry, number)}
                  onDelete={() => deleteBatch(batch)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}

function BatchRow({
  batch,
  canDelete,
  saving,
  onSave,
  onDelete,
}: {
  batch: Batch;
  canDelete: boolean;
  saving: boolean;
  onSave: (expiry: string, number: string) => void;
  onDelete: () => void;
}) {
  const [expiry, setExpiry] = useState(batch.expiryDate ? batch.expiryDate.slice(0, 10) : '');
  const [number, setNumber] = useState(batch.batchNumber ?? '');
  const changed = expiry !== (batch.expiryDate ? batch.expiryDate.slice(0, 10) : '') || number !== (batch.batchNumber ?? '');

  return (
    <tr>
      <td className="numeric">{batch.quantity}</td>
      <td>
        <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </td>
      <td>
        <input value={number} onChange={(e) => setNumber(e.target.value)} />
      </td>
      <td>
        <div className={styles.actions}>
          {changed && (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(expiry, number)}>
              حفظ
            </Button>
          )}
          {canDelete && batch.quantity === 0 && (
            <Button variant="outline" size="sm" onClick={onDelete} aria-label="حذف الدفعة">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
