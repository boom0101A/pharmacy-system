import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import type { Supplier } from '@pharmacy/shared-types';
import styles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { SupplierDialog } from './SupplierDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

export function Suppliers() {
  const toast = useToast();
  const canDelete = useAuth((s) => s.can('admin'));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    try {
      setSuppliers(await api.suppliers());
    } catch (err) {
      toast.error('تعذّر تحميل الموردين', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(supplier: Supplier) {
    try {
      await api.deleteSupplier(supplier.id);
      toast.success('تم حذف المورّد');
      load();
    } catch (err) {
      toast.error('تعذّر الحذف', (err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.spacer}>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} />
            مورّد جديد
          </Button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <table className={styles.table}>
            <tbody>
              <SkeletonRows rows={3} columns={4} />
            </tbody>
          </table>
        ) : suppliers.length === 0 ? (
          <EmptyState icon={<Truck size={26} />} title="لا يوجد موردون بعد" />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>العنوان</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className={styles.name}>{s.name}</td>
                  <td className={styles.numericCell}>{s.phone ?? '—'}</td>
                  <td>{s.address ?? '—'}</td>
                  <td>
                    <div className={styles.actions}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(s);
                          setDialogOpen(true);
                        }}
                        aria-label={`تعديل ${s.name}`}
                      >
                        <Pencil size={15} />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(s)}
                          aria-label={`حذف ${s.name}`}
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} onSaved={load} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف "${deleting?.name}"؟`}
        description="لا يمكن التراجع عن هذا الإجراء."
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  );
}
