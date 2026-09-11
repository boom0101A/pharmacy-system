import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useState } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, XCircle } from 'lucide-react';
import styles from './Toast.module.css';
const ToastContext = createContext(null);
let nextId = 1;
export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const push = useCallback((tone, title, description) => {
        const id = nextId++;
        setItems((prev) => [...prev, { id, tone, title, description }]);
    }, []);
    const remove = useCallback((id) => {
        setItems((prev) => prev.filter((t) => t.id !== id));
    }, []);
    const value = {
        success: (title, description) => push('success', title, description),
        error: (title, description) => push('error', title, description),
    };
    return (_jsx(ToastContext.Provider, { value: value, children: _jsxs(RadixToast.Provider, { swipeDirection: "up", children: [children, items.map((item) => (_jsxs(RadixToast.Root, { className: styles.toast, "data-tone": item.tone, duration: 4000, onOpenChange: (open) => !open && remove(item.id), children: [item.tone === 'success' ? (_jsx(CheckCircle2, { size: 18, className: styles.icon })) : (_jsx(XCircle, { size: 18, className: styles.icon })), _jsxs("div", { children: [_jsx(RadixToast.Title, { className: styles.title, children: item.title }), item.description && (_jsx(RadixToast.Description, { className: styles.description, children: item.description }))] })] }, item.id))), _jsx(RadixToast.Viewport, { className: styles.viewport })] }) }));
}
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
