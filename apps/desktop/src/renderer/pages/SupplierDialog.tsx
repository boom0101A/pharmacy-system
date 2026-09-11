import { useEffect, useState, type FormEvent } from 'react';
import type { Supplier } from '@pharmacy/shared-types';
import styles from '../styles/dataPage.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSaved: () => void;
}

const EMPTY = { name: '', phone: '', address: '' };

export function SupplierDialog({ open, onOpenChange, supplier, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      supplier
        ? { name: supplier.name, phone: supplier.phone ?? '', address: supplier.address ?? '' }
        : EMPTY,
    );
  }, [open, supplier]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error('الاسم مطلوب');

    setSaving(true);
    try {
      const data = { name, phone: form.phone.trim() || null, address: form.address.trim() || null };
      if (supplier) {
        await api.updateSupplier(supplier.id, data);
        toast.success('تم تحديث المورّد');
      } else {
        await api.createSupplier(data);
        toast.success('تمت إضافة المورّد');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error('تعذّر الحفظ', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={supplier ? 'تعديل مورّد' : 'مورّد جديد'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button form="supplier-form" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" className={styles.formGrid} onSubmit={handleSubmit}>
        <div className={styles.formGridFull}>
          <Input
            label="الاسم"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <Input
          label="الهاتف"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          dir="ltr"
        />
        <Input
          label="العنوان"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </form>
    </Dialog>
  );
}
