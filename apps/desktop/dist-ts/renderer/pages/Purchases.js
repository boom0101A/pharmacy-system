import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, ShoppingBag, Trash2 } from 'lucide-react';
import styles from './Purchases.module.css';
import dataPageStyles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { ProductPicker } from '../components/ui/ProductPicker';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { formatDate, formatMoney } from '../lib/cx';
let nextKey = 1;
export function Purchases() {
    const toast = useToast();
    const [suppliers, setSuppliers] = useState([]);
    const [supplierId, setSupplierId] = useState('');
    const [lines, setLines] = useState([]);
    const [saving, setSaving] = useState(false);
    const [purchases, setPurchases] = useState([]);
    const [loadingPurchases, setLoadingPurchases] = useState(true);
    useEffect(() => {
        api.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
        loadPurchases();
    }, []);
    function loadPurchases() {
        setLoadingPurchases(true);
        api
            .purchases()
            .then(setPurchases)
            .catch((err) => toast.error('تعذّر تحميل المشتريات', err.message))
            .finally(() => setLoadingPurchases(false));
    }
    function addProduct(product) {
        if (lines.some((l) => l.productId === product.id))
            return;
        setLines((prev) => [
            ...prev,
            {
                key: nextKey++,
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitPrice: product.purchasePrice,
                batchNumber: null,
                expiryDate: null,
            },
        ]);
    }
    function updateLine(key, patch) {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    }
    function removeLine(key) {
        setLines((prev) => prev.filter((l) => l.key !== key));
    }
    const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    async function submit() {
        if (!supplierId)
            return toast.error('اختر المورّد أولاً');
        if (lines.length === 0)
            return toast.error('أضف صنفاً واحداً على الأقل');
        setSaving(true);
        try {
            await api.createPurchase({
                supplierId: Number(supplierId),
                items: lines.map((l) => ({
                    productId: l.productId,
                    quantity: l.quantity,
                    unitPrice: l.unitPrice,
                    batchNumber: l.batchNumber,
                    expiryDate: l.expiryDate,
                })),
            });
            toast.success('تم تسجيل فاتورة الشراء واستلام الكمية');
            setLines([]);
            setSupplierId('');
            loadPurchases();
        }
        catch (err) {
            toast.error('تعذّر حفظ الفاتورة', err.message);
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.form, children: [_jsxs("div", { className: styles.formRow, children: [_jsxs("div", { className: dataPageStyles.field, children: [_jsx("label", { className: dataPageStyles.label, htmlFor: "purchase-supplier", children: "\u0627\u0644\u0645\u0648\u0631\u0651\u062F" }), _jsxs("select", { id: "purchase-supplier", className: dataPageStyles.select, value: supplierId, onChange: (e) => setSupplierId(e.target.value), children: [_jsx("option", { value: "", children: "\u0627\u062E\u062A\u0631 \u0645\u0648\u0631\u0651\u062F\u0627\u064B" }), suppliers.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })] }), _jsx("div", { className: styles.picker, children: _jsx(ProductPicker, { onSelect: addProduct, placeholder: "\u0623\u0636\u0641 \u0635\u0646\u0641\u0627\u064B \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629\u2026" }) })] }), lines.length > 0 && (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629" }), _jsx("th", { children: "\u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621" }), _jsx("th", { children: "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629" }), _jsx("th", { children: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621" }), _jsx("th", {})] }) }), _jsx("tbody", { children: lines.map((line) => (_jsxs("tr", { children: [_jsx("td", { children: line.productName }), _jsx("td", { children: _jsx("input", { type: "number", min: 1, className: styles.cellInput, value: line.quantity, onChange: (e) => updateLine(line.key, { quantity: Number(e.target.value) || 1 }) }) }), _jsx("td", { children: _jsx("input", { type: "number", min: 0, className: styles.cellInput, value: line.unitPrice, onChange: (e) => updateLine(line.key, { unitPrice: Number(e.target.value) || 0 }) }) }), _jsx("td", { children: _jsx("input", { className: styles.cellInput, value: line.batchNumber ?? '', onChange: (e) => updateLine(line.key, { batchNumber: e.target.value || null }) }) }), _jsx("td", { children: _jsx("input", { type: "date", className: styles.cellInput, value: line.expiryDate?.slice(0, 10) ?? '', onChange: (e) => updateLine(line.key, { expiryDate: e.target.value || null }) }) }), _jsx("td", { children: _jsx("button", { type: "button", className: styles.removeLine, onClick: () => removeLine(line.key), children: _jsx(Trash2, { size: 14 }) }) })] }, line.key))) })] })), _jsxs("div", { className: styles.footerBar, children: [_jsxs("span", { className: styles.total, children: ["\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ", formatMoney(total), " \u062F.\u0639"] }), _jsxs(Button, { onClick: submit, disabled: saving || lines.length === 0, children: [_jsx(Plus, { size: 16 }), saving ? 'جارٍ الحفظ…' : 'حفظ الفاتورة واستلام الكمية'] })] })] }), _jsx("div", { className: dataPageStyles.tableWrap, children: loadingPurchases ? (_jsx("table", { className: dataPageStyles.table, children: _jsx("tbody", { children: _jsx(SkeletonRows, { rows: 3, columns: 4 }) }) })) : purchases.length === 0 ? (_jsx(EmptyState, { icon: _jsx(ShoppingBag, { size: 26 }), title: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0648\u0627\u062A\u064A\u0631 \u0634\u0631\u0627\u0621 \u0628\u0639\u062F" })) : (_jsxs("table", { className: dataPageStyles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0645\u0648\u0631\u0651\u062F" }), _jsx("th", { children: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E" }), _jsx("th", { children: "\u0639\u062F\u062F \u0627\u0644\u0623\u0635\u0646\u0627\u0641" }), _jsx("th", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" })] }) }), _jsx("tbody", { children: purchases.map((p) => (_jsxs("tr", { children: [_jsx("td", { className: dataPageStyles.name, children: p.supplierName }), _jsx("td", { children: formatDate(p.date) }), _jsx("td", { className: "numeric", children: p.items.length }), _jsx("td", { className: "numeric", children: formatMoney(p.total) })] }, p.id))) })] })) })] }));
}
