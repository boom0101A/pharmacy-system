import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from '../styles/dataPage.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
const ROLE_LABEL = {
    admin: 'مدير',
    pharmacist: 'صيدلي',
    cashier: 'كاشير',
};
const EMPTY = { name: '', username: '', password: '', role: 'cashier', isActive: true };
export function UserDialog({ open, onOpenChange, user, onSaved }) {
    const toast = useToast();
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        setForm(user
            ? { name: user.name, username: user.username, password: '', role: user.role, isActive: user.isActive }
            : EMPTY);
    }, [open, user]);
    async function handleSubmit(event) {
        event.preventDefault();
        const name = form.name.trim();
        const username = form.username.trim();
        if (!name)
            return toast.error('الاسم مطلوب');
        if (!username)
            return toast.error('اسم المستخدم مطلوب');
        // A blank password is fine when editing (keeps the current one) but not on create.
        if (!user && form.password.trim().length < 4) {
            return toast.error('كلمة المرور قصيرة جداً', 'أربعة أحرف على الأقل');
        }
        if (user && form.password && form.password.trim().length < 4) {
            return toast.error('كلمة المرور قصيرة جداً', 'أربعة أحرف على الأقل');
        }
        setSaving(true);
        try {
            const password = form.password.trim();
            if (user) {
                // Omitting password entirely (not sending an empty string) is what
                // tells the server to keep the current one.
                await api.updateUser(user.id, {
                    name,
                    username,
                    role: form.role,
                    isActive: form.isActive,
                    ...(password ? { password } : {}),
                });
                toast.success('تم تحديث المستخدم');
            }
            else {
                await api.createUser({ name, username, role: form.role, password });
                toast.success('تمت إضافة المستخدم');
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
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, title: user ? 'تعديل مستخدم' : 'مستخدم جديد', footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: "\u0625\u0644\u063A\u0627\u0621" }), _jsx(Button, { form: "user-form", type: "submit", disabled: saving, children: saving ? 'جارٍ الحفظ…' : 'حفظ' })] }), children: _jsxs("form", { id: "user-form", className: styles.formGrid, onSubmit: handleSubmit, children: [_jsx(Input, { label: "\u0627\u0644\u0627\u0633\u0645", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), required: true, autoFocus: true }), _jsx(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", value: form.username, onChange: (e) => setForm((f) => ({ ...f, username: e.target.value })), dir: "ltr", required: true, disabled: user !== null, hint: user
                        ? 'لا يمكن تغيير اسم المستخدم بعد الإنشاء'
                        : 'هذا ما يُكتب عند تسجيل الدخول' }), _jsx(Input, { label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", type: "password", value: form.password, onChange: (e) => setForm((f) => ({ ...f, password: e.target.value })), dir: "ltr", hint: user ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : undefined }), _jsxs("div", { className: styles.field, children: [_jsx("label", { className: styles.label, htmlFor: "user-role", children: "\u0627\u0644\u062F\u0648\u0631" }), _jsx("select", { id: "user-role", className: styles.select, value: form.role, onChange: (e) => setForm((f) => ({ ...f, role: e.target.value })), children: Object.entries(ROLE_LABEL).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) })] }), user && (_jsx("div", { className: styles.formGridFull, children: _jsxs("label", { className: styles.checkboxRow, children: [_jsx("input", { type: "checkbox", checked: form.isActive, onChange: (e) => setForm((f) => ({ ...f, isActive: e.target.checked })) }), "\u062D\u0633\u0627\u0628 \u0646\u0634\u0637 (\u064A\u0645\u0643\u0646\u0647 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644)"] }) }))] }) }));
}
