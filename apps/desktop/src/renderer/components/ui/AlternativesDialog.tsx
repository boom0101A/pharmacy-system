import { useEffect, useState } from 'react';
import type { Product, ProductAlternative } from '@pharmacy/shared-types';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/cx';
import styles from './AlternativesDialog.module.css';

interface Props {
  /** Non-null opens the dialog for this sold-out product. */
  product: Product | null;
  onClose: () => void;
  onPick: (alternativeId: number) => void;
}

/** A dead end turned into a question worth asking: what else has the same active ingredient and is actually in stock. */
export function AlternativesDialog({ product, onClose, onPick }: Props) {
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product) return;
    // A slow reply for a product the cashier has already moved on from must
    // not replace the list for the one now shown.
    let current = true;
    setAlternatives([]);
    setLoading(true);
    api
      .productAlternatives(product.id)
      .then((rows) => current && setAlternatives(rows))
      .catch(() => current && setAlternatives([]))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [product]);

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={product ? `بدائل "${product.name}"` : ''}
      description="أدوية أخرى بنفس المادة الفعّالة ومتوفرة حالياً"
      footer={
        <Button variant="ghost" onClick={onClose}>
          إغلاق
        </Button>
      }
    >
      {loading ? (
        <div className={styles.list}>
          <Skeleton height="3rem" radius="var(--radius-md)" />
          <Skeleton height="3rem" radius="var(--radius-md)" />
        </div>
      ) : alternatives.length === 0 ? (
        <p className={styles.empty}>لا توجد بدائل متوفرة حالياً</p>
      ) : (
        <div className={styles.list}>
          {alternatives.map((alt) => (
            <button key={alt.id} type="button" className={styles.item} onClick={() => onPick(alt.id)}>
              <span>{alt.name}</span>
              <span className={styles.meta}>
                <span className="numeric">{formatMoney(alt.salePrice)}</span>
                <span className="numeric">{alt.stock} {alt.unit}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
