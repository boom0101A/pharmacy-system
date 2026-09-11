import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Search, Undo2 } from 'lucide-react';
import styles from './Returns.module.css';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { formatDate, formatMoney, formatTime } from '../lib/cx';
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
export function Returns() {
    const toast = useToast();
    const canSeeHistory = useAuth((s) => s.can('admin', 'pharmacist'));
    const [saleIdInput, setSaleIdInput] = useState('');
    const [sale, setSale] = useState(null);
    const [quantities, setQuantities] = useState({});
    const [reason, setReason] = useState('');
    const [looking, setLooking] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [browseDate, setBrowseDate] = useState(() => isoDate(new Date()));
    const [browseSales, setBrowseSales] = useState([]);
    const [loadingBrowse, setLoadingBrowse] = useState(false);
    const loadHistory = useCallback(async () => {
        if (!canSeeHistory)
            return;
        try {
            setHistory(await api.returns());
        }
        catch (err) {
            toast.error('تعذّر تحميل سجل الإرجاعات', err.message);
        }
        finally {
            setLoadingHistory(false);
        }
    }, [canSeeHistory, toast]);
    useEffect(() => {
        loadHistory();
    }, [loadHistory]);
    const loadBrowseSales = useCallback(async () => {
        if (!canSeeHistory)
            return;
        setLoadingBrowse(true);
        try {
            setBrowseSales(await api.salesByDate(browseDate));
        }
        catch (err) {
            toast.error('تعذّر تحميل مبيعات هذا اليوم', err.message);
        }
        finally {
            setLoadingBrowse(false);
        }
    }, [canSeeHistory, browseDate, toast]);
    useEffect(() => {
        loadBrowseSales();
    }, [loadBrowseSales]);
    async function loadSale(id) {
        if (!id)
            return;
        setLooking(true);
        try {
            const found = await api.saleById(id);
            setSale(found);
            setQuantities({});
            setReason('');
        }
        catch (err) {
            setSale(null);
            toast.error('تعذّر إيجاد الفاتورة', err.message);
        }
        finally {
            setLooking(false);
        }
    }
    async function lookupSale(event) {
        event?.preventDefault();
        await loadSale(Number(saleIdInput.trim()));
    }
    function selectBrowsedSale(id) {
        setSaleIdInput(String(id));
        loadSale(id);
    }
    function remainingOf(item) {
        return item.quantity - item.returnedQuantity;
    }
    function setQuantity(saleItemId, value, max) {
        setQuantities((prev) => ({ ...prev, [saleItemId]: Math.max(0, Math.min(value, max)) }));
    }
    const total = sale
        ? sale.items.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * item.unitPrice, 0)
        : 0;
    async function submitReturn() {
        if (!sale)
            return;
        const items = Object.entries(quantities)
            .map(([saleItemId, quantity]) => ({ saleItemId: Number(saleItemId), quantity }))
            .filter((line) => line.quantity > 0);
        if (items.length === 0) {
            toast.error('حدّد كمية إرجاع لصنف واحد على الأقل');
            return;
        }
        setSubmitting(true);
        try {
            const created = await api.createReturn({ saleId: sale.id, items, reason: reason.trim() || null });
            toast.success('تم تنفيذ الإرجاع', `المبلغ المسترجَع ${formatMoney(created.total)} د.ع`);
            setSale(null);
            setSaleIdInput('');
            loadHistory();
        }
        catch (err) {
            toast.error('تعذّر تنفيذ الإرجاع', err.message);
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.form, children: [_jsxs("form", { className: styles.lookupRow, onSubmit: lookupSale, children: [_jsx("div", { className: styles.lookupInput, children: _jsx(Input, { label: "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", type: "number", value: saleIdInput, onChange: (e) => setSaleIdInput(e.target.value), autoFocus: true }) }), _jsxs(Button, { type: "submit", disabled: looking, children: [_jsx(Search, { size: 16 }), looking ? 'جارٍ البحث…' : 'بحث'] })] }), canSeeHistory && !sale && (_jsxs("div", { className: styles.browseSection, children: [_jsxs("div", { className: styles.browseHeader, children: [_jsx("span", { className: styles.browseTitle, children: "\u0623\u0648 \u062A\u0635\u0641\u0651\u062D \u0645\u0628\u064A\u0639\u0627\u062A \u064A\u0648\u0645 \u0645\u064F\u0639\u064A\u0651\u0646" }), _jsx(Input, { type: "date", value: browseDate, onChange: (e) => setBrowseDate(e.target.value), className: styles.browseDateInput })] }), loadingBrowse ? (_jsxs("div", { className: styles.browseSkeleton, children: [_jsx(Skeleton, { height: "2.75rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { height: "2.75rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { height: "2.75rem", radius: "var(--radius-md)" })] })) : browseSales.length === 0 ? (_jsx("p", { className: styles.browseEmpty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0628\u064A\u0639\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645" })) : (_jsx("div", { className: styles.browseList, children: browseSales.map((row) => (_jsxs("button", { type: "button", className: styles.browseItem, disabled: looking, onClick: () => selectBrowsedSale(row.id), children: [_jsxs("span", { className: styles.name, children: ["\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ", row.id, " \u2014 ", formatTime(row.date)] }), _jsxs("span", { className: styles.browseMeta, children: [_jsx("span", { children: row.userName }), _jsxs("span", { children: [row.items.length, " \u0635\u0646\u0641"] }), _jsxs("span", { className: "numeric", children: [formatMoney(row.total), " \u062F.\u0639"] })] })] }, row.id))) }))] })), !sale ? (_jsx("div", { className: styles.empty, children: "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0639\u0631\u0636 \u062A\u0641\u0627\u0635\u064A\u0644\u0647\u0627 \u0648\u0628\u062F\u0621 \u0627\u0644\u0625\u0631\u062C\u0627\u0639" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.saleInfo, children: [_jsxs("span", { children: ["\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ", sale.id] }), _jsxs("span", { className: styles.saleInfoMeta, children: [formatDate(sale.date), " \u2014 ", sale.userName] })] }), _jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0627\u0644\u0645\u064F\u0628\u0627\u0639" }), _jsx("th", { children: "\u0645\u064F\u0631\u062C\u0639 \u0633\u0627\u0628\u0642\u0627\u064B" }), _jsx("th", { children: "\u0627\u0644\u0645\u062A\u0627\u062D" }), _jsx("th", { children: "\u0643\u0645\u064A\u0629 \u0627\u0644\u0625\u0631\u062C\u0627\u0639" })] }) }), _jsx("tbody", { children: sale.items.map((item) => {
                                            const remaining = remainingOf(item);
                                            return (_jsxs("tr", { children: [_jsxs("td", { children: [item.productName, item.isSubUnit && (_jsx("span", { className: styles.unitBadge, children: item.unitLabel }))] }), _jsx("td", { className: "numeric", children: item.quantity }), _jsx("td", { className: "numeric", children: item.returnedQuantity }), _jsx("td", { className: "numeric", children: remaining }), _jsx("td", { children: _jsx("input", { type: "number", min: 0, max: remaining, className: styles.qtyInput, value: quantities[item.id] ?? '', placeholder: "0", disabled: remaining === 0, onChange: (e) => setQuantity(item.id, Number(e.target.value), remaining) }) })] }, item.id));
                                        }) })] }), _jsxs("div", { className: styles.footerBar, children: [_jsx("div", { className: styles.reasonField, children: _jsx(Input, { label: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062C\u0627\u0639 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)", value: reason, onChange: (e) => setReason(e.target.value) }) }), _jsxs("div", { className: styles.totalBlock, children: [_jsxs("div", { className: styles.grandTotal, children: [formatMoney(total), " \u062F.\u0639"] }), _jsxs(Button, { variant: "danger", onClick: submitReturn, disabled: submitting || total === 0, children: [_jsx(Undo2, { size: 16 }), submitting ? 'جارٍ التنفيذ…' : 'تنفيذ الإرجاع'] })] })] })] }))] }), canSeeHistory && (_jsxs("div", { className: styles.history, children: [_jsx("h2", { className: styles.historyTitle, children: "\u0622\u062E\u0631 \u0627\u0644\u0625\u0631\u062C\u0627\u0639\u0627\u062A" }), loadingHistory ? (_jsxs("div", { className: styles.historySkeleton, children: [_jsx(Skeleton, { height: "3.5rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { height: "3.5rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { height: "3.5rem", radius: "var(--radius-md)" })] })) : history.length === 0 ? (_jsx("p", { className: styles.historyEmpty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0631\u062C\u0627\u0639\u0627\u062A \u0628\u0639\u062F" })) : (history.map((r) => (_jsxs("div", { className: styles.historyItem, children: [_jsxs("div", { className: styles.name, children: ["\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ", r.saleId] }), _jsxs("div", { className: styles.historyMeta, children: [_jsx("span", { children: formatDate(r.date) }), _jsx("span", { className: "numeric", children: formatMoney(r.total) })] })] }, r.id))))] }))] }));
}
