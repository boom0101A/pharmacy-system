import { useEffect, useState } from 'react';
import type { Category } from '@pharmacy/shared-types';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';

interface DeleteCategoryDialogProps {
  /** The category being deleted; the dialog is open while this is set. */
  category: Category | null;
  categories: Category[];
  onCancel: () => void;
  /** Where its medicines go: another category, or null for "no category". */
  onConfirm: (moveTo: Category | null) => void;
}

/**
 * Deleting a category never deletes its medicines — this only asks where
 * they should land instead of silently leaving them uncategorised.
 */
export function DeleteCategoryDialog({ category, categories, onCancel, onConfirm }: DeleteCategoryDialogProps) {
  const [targetId, setTargetId] = useState('');
  const count = category?.productCount ?? 0;
  const others = categories.filter((c) => c.id !== category?.id);

  useEffect(() => setTargetId(''), [category]);

  return (
    <Dialog
      open={category !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={`حذف تصنيف «${category?.name ?? ''}»؟`}
      description={count ? undefined : 'لا يوجد دواء مرتبط بهذا التصنيف.'}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(others.find((c) => String(c.id) === targetId) ?? null)}
          >
            حذف
          </Button>
        </>
      }
    >
      {count > 0 && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0 }}>
            {count} دواء مرتبط بهذا التصنيف — لن يُحذف أي دواء، اختر أين تنتقل:
          </p>
          <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            انقل أدويته إلى
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={{
                height: '2.5rem',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                font: 'inherit',
                fontWeight: 400,
                background: 'var(--surface-card)',
              }}
            >
              <option value="">بدون تصنيف</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </Dialog>
  );
}
