import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { WifiOff } from 'lucide-react';
import styles from './ConnectionBanner.module.css';
import { useConnection } from '../store/connection';
/** A dead server is worth saying even on the login screen — it's usually the real reason "the password isn't working". */
export function ConnectionBanner({ onRetry }) {
    const online = useConnection((s) => s.online);
    if (online)
        return null;
    return (_jsxs("div", { className: styles.banner, role: "alert", children: [_jsx(WifiOff, { size: 16 }), _jsx("span", { children: "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645 \u2014 \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0634\u0628\u0643\u0629" }), _jsx("button", { type: "button", className: styles.retry, onClick: onRetry, children: "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" })] }));
}
