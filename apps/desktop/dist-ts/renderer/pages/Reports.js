import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './Reports.module.css';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { formatDate, formatMoney } from '../lib/cx';
import { useAuth } from '../store/auth';
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
const TABS = [
    { key: 'sales', label: 'المبيعات' },
    { key: 'top-products', label: 'الأكثر مبيعاً' },
    { key: 'by-category', label: 'حسب التصنيف' },
    { key: 'expiry', label: 'الصلاحية' },
    { key: 'low-stock', label: 'المخزون المنخفض' },
];
export function Reports() {
    const toast = useToast();
    const canSeeProfit = useAuth((s) => s.can('admin'));
    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 86_400_000);
    const [from, setFrom] = useState(isoDate(monthAgo));
    const [to, setTo] = useState(isoDate(today));
    const [tab, setTab] = useState('sales');
    const [sales, setSales] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [profit, setProfit] = useState([]);
    const [byCategory, setByCategory] = useState([]);
    const [expiry, setExpiry] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    useEffect(() => {
        Promise.all([
            api.reportSales(from, to).then(setSales),
            api.reportTopProducts(from, to).then(setTopProducts),
            api.reportByCategory(from, to).then(setByCategory),
            api.reportExpiry().then(setExpiry),
            api.reportLowStock().then(setLowStock),
            canSeeProfit ? api.reportProfit(from, to).then(setProfit) : Promise.resolve(),
        ]).catch((err) => toast.error('تعذّر تحميل التقارير', err.message));
    }, [from, to, canSeeProfit, toast]);
    const totalRevenue = sales.reduce((sum, p) => sum + p.total, 0);
    const totalProfit = profit.reduce((sum, p) => sum + p.profit, 0);
    const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    return (_jsxs("div", { children: [_jsxs("div", { className: styles.filters, children: [_jsx(Input, { label: "\u0645\u0646", type: "date", value: from, onChange: (e) => setFrom(e.target.value) }), _jsx(Input, { label: "\u0625\u0644\u0649", type: "date", value: to, onChange: (e) => setTo(e.target.value) })] }), _jsxs("div", { className: styles.summary, children: [_jsx(SummaryCard, { label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", value: formatMoney(totalRevenue) }), canSeeProfit && _jsx(SummaryCard, { label: "\u0635\u0627\u0641\u064A \u0627\u0644\u0631\u0628\u062D", value: formatMoney(totalProfit) }), canSeeProfit && _jsx(SummaryCard, { label: "\u0647\u0627\u0645\u0634 \u0627\u0644\u0631\u0628\u062D", value: `${margin}%` })] }), _jsx("div", { className: styles.tabs, role: "tablist", children: TABS.map((t) => (_jsx("button", { role: "tab", className: t.key === tab ? styles.tabActive : styles.tab, onClick: () => setTab(t.key), children: t.label }, t.key))) }), tab === 'sales' && (_jsx("div", { className: styles.chartCard, children: _jsx(ResponsiveContainer, { width: "100%", height: 320, children: _jsxs(LineChart, { data: sales, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "date", tickFormatter: (d) => formatDate(d) }), _jsx(YAxis, {}), _jsx(Tooltip, { labelFormatter: (d) => formatDate(String(d)), formatter: (v) => formatMoney(Number(v)) }), _jsx(Line, { type: "monotone", dataKey: "total", stroke: "var(--brand-9)", strokeWidth: 2, dot: false })] }) }) })), tab === 'top-products' && (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629" }), _jsx("th", { children: "\u0627\u0644\u0625\u064A\u0631\u0627\u062F" })] }) }), _jsx("tbody", { children: topProducts.map((p) => (_jsxs("tr", { children: [_jsx("td", { children: p.productName }), _jsx("td", { className: "numeric", children: p.quantity }), _jsx("td", { className: "numeric", children: formatMoney(p.revenue) })] }, p.productId))) })] })), tab === 'by-category' && (_jsx("div", { className: styles.chartCard, children: _jsx(ResponsiveContainer, { width: "100%", height: 320, children: _jsxs(BarChart, { data: byCategory, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "categoryName" }), _jsx(YAxis, {}), _jsx(Tooltip, { formatter: (v) => formatMoney(Number(v)) }), _jsx(Bar, { dataKey: "revenue", fill: "var(--accent-9)" })] }) }) })), tab === 'expiry' && (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629" }), _jsx("th", { children: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621" }), _jsx("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629" })] }) }), _jsx("tbody", { children: expiry.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.productName }), _jsx("td", { children: row.batchNumber ?? '—' }), _jsx("td", { children: formatDate(row.expiryDate) }), _jsx("td", { className: "numeric", children: row.quantity })] }, row.batchId))) })] })), tab === 'low-stock' && (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0627\u0644\u0645\u062A\u0648\u0641\u0631" }), _jsx("th", { children: "\u062D\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628" })] }) }), _jsx("tbody", { children: lowStock.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.productName }), _jsx("td", { className: "numeric", children: row.stock }), _jsx("td", { className: "numeric", children: row.reorderLevel })] }, row.productId))) })] }))] }));
}
function SummaryCard({ label, value }) {
    return (_jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: `${styles.summaryValue} numeric`, children: value }), _jsx("div", { className: styles.summaryLabel, children: label })] }));
}
