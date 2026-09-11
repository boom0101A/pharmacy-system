import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import styles from './Inventory.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
/**
 * Receiving stock creates a batch, not a bare quantity bump — each intake keeps
 * its own expiry date so the till can sell earliest-expiring stock first.
 */
export function ReceiveStockDialog({ product, onClose, onSaved }) {
    const toast = useToast();
    const [quantity, setQuantity] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [saving, setSaving] = useState(false);
    const canDeleteBatch = useAuth((s) => s.can('admin'));
    const [batches, setBatches] = useState([]);
    const [savingBatchId, setSavingBatchId] = useState(null);
    const loadBatches = useCallback(async (productId) => {
        try {
            setBatches(await api.batches(productId));
        }
        catch {
            setBatches([]);
        }
    }, []);
    useEffect(() => {
        if (product) {
            setQuantity('');
            setExpiryDate('');
            setBatchNumber('');
            setPurchasePrice(String(product.purchasePrice));
            loadBatches(product.id);
        }
    }, [product, loadBatches]);
    async function handleSubmit(event) {
        event.preventDefault();
        if (!product)
            return;
        setSaving(true);
        try {
            await api.createBatch({
                productId: product.id,
                quantity: Number(quantity),
                expiryDate: expiryDate || null,
                batchNumber: batchNumber.trim() || null,
                purchasePrice: Number(purchasePrice) || 0,
            });
            toast.success('تمت إضافة الكمية', `${quantity} ${product.unit} من "${product.name}"`);
            // The dialog stays open so the new batch shows up in the list below —
            // seeing it is the whole point: it explains why the table's "nearest
            // expiry" may still show an older batch's date.
            setQuantity('');
            setExpiryDate('');
            setBatchNumber('');
            loadBatches(product.id);
            onSaved();
        }
        catch (err) {
            toast.error('تعذّر إضافة الكمية', err.message);
        }
        finally {
            setSaving(false);
        }
    }
    async function saveBatchEdit(batch, expiry, number) {
        setSavingBatchId(batch.id);
        try {
            await api.updateBatch(batch.id, {
                expiryDate: expiry || null,
                batchNumber: number.trim() || null,
            });
            if (product)
                loadBatches(product.id);
            onSaved();
        }
        catch (err) {
            toast.error('تعذّر حفظ التعديل', err.message);
        }
        finally {
            setSavingBatchId(null);
        }
    }
    async function deleteBatch(batch) {
        try {
            await api.deleteBatch(batch.id);
            toast.success('تم حذف الدفعة');
            if (product)
                loadBatches(product.id);
            onSaved();
        }
        catch (err) {
            toast.error('تعذّر الحذف', err.message);
        }
    }
    return (_jsxs(Dialog, { open: product !== null, onOpenChange: (open) => !open && onClose(), title: product ? `إدخال كمية — ${product.name}` : '', footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "\u0625\u063A\u0644\u0627\u0642" }), _jsx(Button, { form: "batch-form", type: "submit", disabled: saving, children: saving ? 'جارٍ الحفظ…' : 'إضافة' })] }), children: [_jsxs("form", { id: "batch-form", className: styles.formGrid, onSubmit: handleSubmit, children: [_jsx(Input, { label: "\u0627\u0644\u0643\u0645\u064A\u0629", inputMode: "numeric", value: quantity, onChange: (e) => setQuantity(e.target.value.replace(/[^\d]/g, '')), required: true, autoFocus: true }), _jsx(Input, { label: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621", type: "date", value: expiryDate, onChange: (e) => setExpiryDate(e.target.value) }), _jsx(Input, { label: "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629", value: batchNumber, onChange: (e) => setBatchNumber(e.target.value) }), _jsx(Input, { label: "\u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621", inputMode: "decimal", value: purchasePrice, onChange: (e) => setPurchasePrice(e.target.value) })] }), batches.length > 0 && (_jsxs("div", { style: { marginTop: 'var(--space-6)' }, children: [_jsx("h3", { style: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }, children: "\u0627\u0644\u062F\u0641\u0639\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629" }), _jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629" }), _jsx("th", { children: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621" }), _jsx("th", { children: "\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629" }), _jsx("th", {})] }) }), _jsx("tbody", { children: batches.map((batch) => (_jsx(BatchRow, { batch: batch, canDelete: canDeleteBatch, saving: savingBatchId === batch.id, onSave: (expiry, number) => saveBatchEdit(batch, expiry, number), onDelete: () => deleteBatch(batch) }, batch.id))) })] })] }))] }));
}
function BatchRow({ batch, canDelete, saving, onSave, onDelete, }) {
    const [expiry, setExpiry] = useState(batch.expiryDate ? batch.expiryDate.slice(0, 10) : '');
    const [number, setNumber] = useState(batch.batchNumber ?? '');
    const changed = expiry !== (batch.expiryDate ? batch.expiryDate.slice(0, 10) : '') || number !== (batch.batchNumber ?? '');
    return (_jsxs("tr", { children: [_jsx("td", { className: "numeric", children: batch.quantity }), _jsx("td", { children: _jsx("input", { type: "date", value: expiry, onChange: (e) => setExpiry(e.target.value) }) }), _jsx("td", { children: _jsx("input", { value: number, onChange: (e) => setNumber(e.target.value) }) }), _jsx("td", { children: _jsxs("div", { className: styles.actions, children: [changed && (_jsx(Button, { variant: "outline", size: "sm", disabled: saving, onClick: () => onSave(expiry, number), children: "\u062D\u0641\u0638" })), canDelete && batch.quantity === 0 && (_jsx(Button, { variant: "outline", size: "sm", onClick: onDelete, "aria-label": "\u062D\u0630\u0641 \u0627\u0644\u062F\u0641\u0639\u0629", children: _jsx(Trash2, { size: 14 }) }))] }) })] }));
}
