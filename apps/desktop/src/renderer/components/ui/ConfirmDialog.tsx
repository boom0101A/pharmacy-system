import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import styles from './ConfirmDialog.module.css';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/**
 * A destructive-action confirmation, distinct from the regular Dialog: it
 * cannot be dismissed by clicking an X or outside the content — only an
 * explicit choice — which is exactly what AlertDialog is for over Dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'حذف',
  cancelLabel = 'إلغاء',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className={styles.overlay} />
        <RadixAlertDialog.Content className={styles.content}>
          <RadixAlertDialog.Title className={styles.title}>{title}</RadixAlertDialog.Title>
          {description && (
            <RadixAlertDialog.Description className={styles.description}>
              {description}
            </RadixAlertDialog.Description>
          )}

          <div className={styles.footer}>
            <RadixAlertDialog.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
