import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from '../styles/dataPage.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
const EMPTY = { name: '', phone: '', address: '' };
export function SupplierDialog({ open, onOpenChange, supplier, onSaved }) {
    const toast = useToast();
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        setForm(supplier
            ? { name: supplier.name, phone: supplier.phone ?? '', address: supplier.address ?? '' }
            : EMPTY);
    }, [open, supplier]);
    async function handleSubmit(event) {
        event.preventDefault();
        const name = form.name.trim();
        if (!name)
            return toast.error('الاسم مطلوب');
        setSaving(true);
        try {
            const data = { name, phone: form.phone.trim() || null, address: form.address.trim() || null };
            if (supplier) {
                await api.updateSupplier(supplier.id, data);
                toast.success('تم تحديث المورّد');
            }
            else {
                await api.createSupplier(data);
                toast.success('تمت إضافة المورّد');
            }
            onOpenChange(false);
            onSaved();
        }
        catch (err) {
            toast.error('تعذّر الحفظ', err.message);
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, title: supplier ? 'تعديل مورّد' : 'مورّد جديد', footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: "\u0625\u0644\u063A\u0627\u0621" }), _jsx(Button, { form: "supplier-form", type: "submit", disabled: saving, children: saving ? 'جارٍ الحفظ…' : 'حفظ' })] }), children: _jsxs("form", { id: "supplier-form", className: styles.formGrid, onSubmit: handleSubmit, children: [_jsx("div", { className: styles.formGridFull, children: _jsx(Input, { label: "\u0627\u0644\u0627\u0633\u0645", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), required: true, autoFocus: true }) }), _jsx(Input, { label: "\u0627\u0644\u0647\u0627\u062A\u0641", value: form.phone, onChange: (e) => setForm((f) => ({ ...f, phone: e.target.value })), dir: "ltr" }), _jsx(Input, { label: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", value: form.address, onChange: (e) => setForm((f) => ({ ...f, address: e.target.value })) })] }) }));
}
