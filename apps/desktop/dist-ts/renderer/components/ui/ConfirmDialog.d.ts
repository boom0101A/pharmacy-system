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
export declare function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, onConfirm, }: ConfirmDialogProps): import("react").JSX.Element;
export {};
