import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import styles from './Dialog.module.css';
/**
 * Radix Dialog handles focus trapping, escape-to-close and the accessible
 * title/description wiring; everything visual comes from the CSS Module.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, onCloseAutoFocus, }) {
    return (_jsx(RadixDialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(RadixDialog.Portal, { children: [_jsx(RadixDialog.Overlay, { className: styles.overlay }), _jsxs(RadixDialog.Content, { className: styles.content, onCloseAutoFocus: onCloseAutoFocus, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { children: [_jsx(RadixDialog.Title, { className: styles.title, children: title }), description && (_jsx(RadixDialog.Description, { className: styles.description, children: description }))] }), _jsx(RadixDialog.Close, { className: styles.close, "aria-label": "\u0625\u063A\u0644\u0627\u0642", children: _jsx(X, { size: 18 }) })] }), _jsx("div", { className: styles.body, children: children }), footer && _jsx("div", { className: styles.footer, children: footer })] })] }) }));
}
