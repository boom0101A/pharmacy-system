import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import styles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { UserDialog } from './UserDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
const ROLE_LABEL = {
    admin: 'مدير',
    pharmacist: 'صيدلي',
    cashier: 'كاشير',
};
const ROLE_TONE = {
    admin: 'info',
    pharmacist: 'success',
    cashier: 'neutral',
};
export function Users() {
    const toast = useToast();
    const currentUserId = useAuth((s) => s.user?.id);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const load = useCallback(async () => {
        try {
            setUsers(await api.users());
        }
        catch (err) {
            toast.error('تعذّر تحميل المستخدمين', err.message);
        }
        finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => {
        load();
    }, [load]);
    async function remove(user) {
        try {
            await api.deleteUser(user.id);
            toast.success('تم حذف المستخدم');
            load();
        }
        catch (err) {
            // A user with prior sales/purchases can't be deleted (server enforces this).
            toast.error('تعذّر الحذف', err.message);
        }
        finally {
            setDeleting(null);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.toolbar, children: _jsx("div", { className: styles.spacer, children: _jsxs(Button, { onClick: () => {
                            setEditing(null);
                            setDialogOpen(true);
                        }, children: [_jsx(Plus, { size: 16 }), "\u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F"] }) }) }), _jsx("div", { className: styles.tableWrap, children: loading ? (_jsx("table", { className: styles.table, children: _jsx("tbody", { children: _jsx(SkeletonRows, { rows: 3, columns: 5 }) }) })) : users.length === 0 ? (_jsx(EmptyState, { icon: _jsx(UsersIcon, { size: 26 }), title: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646 \u0628\u0639\u062F", description: "\u0623\u0646\u0634\u0626 \u062D\u0633\u0627\u0628\u0627\u062A \u0644\u0644\u0635\u064A\u0627\u062F\u0644\u0629 \u0648\u0627\u0644\u0643\u0627\u0634\u064A\u0631\u064A\u0646 \u0644\u062A\u062D\u062F\u064A\u062F \u0635\u0644\u0627\u062D\u064A\u0629 \u0643\u0644 \u0648\u0627\u062D\u062F \u0645\u0646\u0647\u0645." })) : (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0627\u0633\u0645" }), _jsx("th", { children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645" }), _jsx("th", { children: "\u0627\u0644\u062F\u0648\u0631" }), _jsx("th", { children: "\u0627\u0644\u062D\u0627\u0644\u0629" }), _jsx("th", {})] }) }), _jsx("tbody", { children: users.map((u) => {
                                const isSelf = u.id === currentUserId;
                                return (_jsxs("tr", { children: [_jsxs("td", { className: styles.name, children: [u.name, isSelf && _jsx(Badge, { tone: "neutral", children: " \u0623\u0646\u062A" })] }), _jsx("td", { className: styles.numericCell, children: u.username }), _jsx("td", { children: _jsx(Badge, { tone: ROLE_TONE[u.role], children: ROLE_LABEL[u.role] }) }), _jsx("td", { children: _jsx(Badge, { tone: u.isActive ? 'success' : 'danger', children: u.isActive ? 'نشط' : 'معطّل' }) }), _jsx("td", { children: _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                                            setEditing(u);
                                                            setDialogOpen(true);
                                                        }, "aria-label": `تعديل ${u.name}`, children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setDeleting(u), disabled: isSelf, "aria-label": `حذف ${u.name}`, title: isSelf ? 'لا يمكنك حذف حسابك الخاص' : undefined, children: _jsx(Trash2, { size: 15 }) })] }) })] }, u.id));
                            }) })] })) }), _jsx(UserDialog, { open: dialogOpen, onOpenChange: setDialogOpen, user: editing, onSaved: load }), _jsx(ConfirmDialog, { open: deleting !== null, onOpenChange: (open) => !open && setDeleting(null), title: `حذف "${deleting?.name}"؟`, description: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621.", onConfirm: () => deleting && remove(deleting) })] }));
}
