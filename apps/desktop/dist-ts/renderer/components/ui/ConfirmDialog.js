import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import styles from './ConfirmDialog.module.css';
import { Button } from './Button';
/**
 * A destructive-action confirmation, distinct from the regular Dialog: it
 * cannot be dismissed by clicking an X or outside the content — only an
 * explicit choice — which is exactly what AlertDialog is for over Dialog.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'حذف', cancelLabel = 'إلغاء', onConfirm, }) {
    return (_jsx(RadixAlertDialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(RadixAlertDialog.Portal, { children: [_jsx(RadixAlertDialog.Overlay, { className: styles.overlay }), _jsxs(RadixAlertDialog.Content, { className: styles.content, children: [_jsx(RadixAlertDialog.Title, { className: styles.title, children: title }), description && (_jsx(RadixAlertDialog.Description, { className: styles.description, children: description })), _jsxs("div", { className: styles.footer, children: [_jsx(RadixAlertDialog.Cancel, { asChild: true, children: _jsx(Button, { variant: "ghost", children: cancelLabel }) }), _jsx(RadixAlertDialog.Action, { asChild: true, children: _jsx(Button, { variant: "danger", onClick: onConfirm, children: confirmLabel }) })] })] })] }) }));
}
