import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './EmptyState.module.css';
export function EmptyState({ icon, title, description, action }) {
    return (_jsxs("div", { className: styles.empty, children: [_jsx("div", { className: styles.icon, children: icon }), _jsx("p", { className: styles.title, children: title }), description && _jsx("p", { className: styles.description, children: description }), action && _jsx("div", { className: styles.action, children: action })] }));
}
