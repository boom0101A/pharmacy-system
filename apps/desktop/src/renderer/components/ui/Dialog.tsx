import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Radix hands focus back to whatever opened the dialog. Callers that need it
   * somewhere else instead — the POS screen must return it to the barcode
   * field — can preventDefault here and place it themselves.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Radix Dialog handles focus trapping, escape-to-close and the accessible
 * title/description wiring; everything visual comes from the CSS Module.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onCloseAutoFocus,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content} onCloseAutoFocus={onCloseAutoFocus}>
          <div className={styles.header}>
            <div>
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className={styles.description}>
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className={styles.close} aria-label="إغلاق">
              <X size={18} />
            </RadixDialog.Close>
          </div>

          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
