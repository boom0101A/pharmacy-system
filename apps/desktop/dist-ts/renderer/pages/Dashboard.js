import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, DollarSign, Receipt } from 'lucide-react';
import styles from './Dashboard.module.css';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { cx, formatMoney } from '../lib/cx';
import { useCountUp } from '../lib/useCountUp';
import { useStockVersion } from '../store/stockSync';
export function Dashboard() {
    const toast = useToast();
    const stockVersion = useStockVersion((s) => s.version);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    // Above the early return below: hooks can't sit behind a conditional, and
    // both settle on the real figure the moment the summary lands.
    const salesTotal = useCountUp(summary?.todaySalesTotal ?? 0);
    const salesCount = useCountUp(summary?.todaySalesCount ?? 0);
    useEffect(() => {
        api
            .dashboard()
            .then(setSummary)
            .catch((err) => toast.error('تعذّر تحميل لوحة التحكم', err.message))
            .finally(() => setLoading(false));
    }, [toast, stockVersion]);
    if (loading || !summary) {
        return (_jsx("div", { className: styles.grid, children: Array.from({ length: 4 }, (_, i) => (_jsx(Skeleton, { height: "7rem", radius: "var(--radius-lg)" }, i))) }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: styles.grid, children: [_jsxs("div", { className: cx(styles.stat, styles.statHero), children: [_jsx("span", { className: styles.statIcon, children: _jsx(DollarSign, { size: 20 }) }), _jsxs("div", { children: [_jsx("div", { className: cx(styles.statValue, 'numeric'), children: formatMoney(salesTotal) }), _jsx("div", { className: styles.statLabel, children: "\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645" })] })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statIcon, children: _jsx(Receipt, { size: 20 }) }), _jsxs("div", { children: [_jsx("div", { className: cx(styles.statValue, 'numeric'), children: salesCount }), _jsx("div", { className: styles.statLabel, children: "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631" })] })] }), _jsxs(Link, { to: "/inventory?filter=low", className: styles.stat, children: [_jsx("span", { className: styles.statIcon, children: _jsx(AlertTriangle, { size: 20 }) }), _jsxs("div", { children: [_jsx("div", { className: cx(styles.statValue, 'numeric'), children: summary.lowStockCount }), _jsx("div", { className: styles.statLabel, children: "\u0623\u0635\u0646\u0627\u0641 \u0645\u0646\u062E\u0641\u0636\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646" })] })] }), _jsxs(Link, { to: "/inventory?filter=expiring", className: styles.stat, children: [_jsx("span", { className: styles.statIcon, children: _jsx(Clock, { size: 20 }) }), _jsxs("div", { children: [_jsx("div", { className: cx(styles.statValue, 'numeric'), children: summary.expiringSoonCount }), _jsx("div", { className: styles.statLabel, children: "\u0642\u0627\u0631\u0628\u062A \u0639\u0644\u0649 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621" })] })] })] }), _jsxs("div", { className: styles.lists, children: [_jsxs("section", { className: styles.listCard, children: [_jsx("h2", { className: styles.listTitle, children: "\u0627\u0644\u0623\u0643\u062B\u0631 \u0627\u062D\u062A\u064A\u0627\u062C\u0627\u064B \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628" }), summary.lowStock.length === 0 ? (_jsx("p", { className: styles.listEmpty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0635\u0646\u0627\u0641 \u0645\u0646\u062E\u0641\u0636\u0629 \u062D\u0627\u0644\u064A\u0627\u064B" })) : (_jsx("ul", { className: styles.list, children: summary.lowStock.map((row) => (_jsxs("li", { children: [_jsx("span", { children: row.name }), _jsxs("span", { className: "numeric", children: [row.value, " \u0645\u062A\u0628\u0642\u064D"] })] }, row.id))) }))] }), _jsxs("section", { className: styles.listCard, children: [_jsx("h2", { className: styles.listTitle, children: "\u0627\u0644\u0623\u0642\u0631\u0628 \u0627\u0646\u062A\u0647\u0627\u0621\u064B" }), summary.expiringSoon.length === 0 ? (_jsx("p", { className: styles.listEmpty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062F\u0641\u0639\u0627\u062A \u0642\u0627\u0631\u0628\u062A \u0639\u0644\u0649 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621" })) : (_jsx("ul", { className: styles.list, children: summary.expiringSoon.map((row) => (_jsxs("li", { children: [_jsx("span", { children: row.name }), _jsxs("span", { className: "numeric", children: [row.value, " \u064A\u0648\u0645"] })] }, row.id))) }))] })] })] }));
}
