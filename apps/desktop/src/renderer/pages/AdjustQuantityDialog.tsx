import { useEffect, useState, type FormEvent } from 'react';
import type { Batch } from '@pharmacy/shared-types';
import form from '../styles/dialogForm.module.css';
import styles from './Inventory.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { cx, digitsOnly } from '../lib/cx';

const QUICK_REASONS = ['خطأ إدخال', 'جرد', 'تالف'];

interface Props {
  /** Non-null opens the dialog for that batch. */
  batch: Batch | null;
  unit: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Corrects a batch's quantity that was typed in wrong. The reason is required
 * and the change is logged on the server for good — lowering stock without a
 * trace is also how a sale goes unrecorded.
 */
export function AdjustQuantityDialog({ batch, unit, onClose, onSaved }: Props) {
  const toast = useToast();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ quantity?: string; reason?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantity('');
    setReason('');
    setErrors({});
  }, [batch]);

  if (!batch) return null;
  const shown = batch;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (quantity === '') next.quantity = 'اكتب الكمية الصحيحة';
    else if (Number(quantity) === shown.quantity) next.quantity = 'الكمية الجديدة مطابقة للحالية';
    if (reason.trim().length < 3) next.reason = 'اكتب سبب التعديل (3 أحرف على الأقل)';
    // All problems at once, not one per click.
    setErrors(next);
    if (next.quantity || next.reason) return;

    setSaving(true);
    try {
      await api.adjustBatch(shown.id, {
        quantity: Number(quantity),
        // What this dialog showed: the server refuses if a sale changed it since.
        expectedQuantity: shown.quantity,
        reason: reason.trim(),
      });
      toast.success('تم تعديل الكمية', `من ${shown.quantity} إلى ${quantity} ${unit}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error('تعذّر تعديل الكمية', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="تعديل كمية الدفعة"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button form="adjust-form" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ التعديل'}
          </Button>
        </>
      }
    >
      <form id="adjust-form" className={form.stack} onSubmit={submit} noValidate>
        <p className={form.text}>
          الكمية الحالية: <strong className="numeric">{shown.quantity}</strong> {unit}
        </p>
        <Input
          label="الكمية الصحيحة"
          inputMode="numeric"
          dir="ltr"
          value={quantity}
          onChange={(e) => setQuantity(digitsOnly(e.target.value))}
          error={errors.quantity}
          markRequired
          autoFocus
        />
        <Input
          label="السبب"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
          markRequired
        />
        <div className={form.row} role="group" aria-label="أسباب شائعة">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className={cx(styles.chip, reason === r && styles.chipActive)}
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {shown.purchaseId != null && (
          <p className={styles.adjustNotice}>
            هذه الدفعة من فاتورة الشراء رقم <span className="numeric">{shown.purchaseId}</span> — ستُصحَّح كميتها
            وإجماليها في الفاتورة بنفس الفرق.
          </p>
        )}
      </form>
    </Dialog>
  );
}
