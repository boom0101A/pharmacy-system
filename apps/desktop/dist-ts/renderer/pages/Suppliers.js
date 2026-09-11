import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import styles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { SupplierDialog } from './SupplierDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
export function Suppliers() {
    const toast = useToast();
    const canDelete = useAuth((s) => s.can('admin'));
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const load = useCallback(async () => {
        try {
            setSuppliers(await api.suppliers());
        }
        catch (err) {
            toast.error('تعذّر تحميل الموردين', err.message);
        }
        finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => {
        load();
    }, [load]);
    async function remove(supplier) {
        try {
            await api.deleteSupplier(supplier.id);
            toast.success('تم حذف المورّد');
            load();
        }
        catch (err) {
            toast.error('تعذّر الحذف', err.message);
        }
        finally {
            setDeleting(null);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.toolbar, children: _jsx("div", { className: styles.spacer, children: _jsxs(Button, { onClick: () => {
                            setEditing(null);
                            setDialogOpen(true);
                        }, children: [_jsx(Plus, { size: 16 }), "\u0645\u0648\u0631\u0651\u062F \u062C\u062F\u064A\u062F"] }) }) }), _jsx("div", { className: styles.tableWrap, children: loading ? (_jsx("table", { className: styles.table, children: _jsx("tbody", { children: _jsx(SkeletonRows, { rows: 3, columns: 4 }) }) })) : suppliers.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Truck, { size: 26 }), title: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0648\u0631\u062F\u0648\u0646 \u0628\u0639\u062F" })) : (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0627\u0633\u0645" }), _jsx("th", { children: "\u0627\u0644\u0647\u0627\u062A\u0641" }), _jsx("th", { children: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646" }), _jsx("th", {})] }) }), _jsx("tbody", { children: suppliers.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: styles.name, children: s.name }), _jsx("td", { className: styles.numericCell, children: s.phone ?? '—' }), _jsx("td", { children: s.address ?? '—' }), _jsx("td", { children: _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                                        setEditing(s);
                                                        setDialogOpen(true);
                                                    }, "aria-label": `تعديل ${s.name}`, children: _jsx(Pencil, { size: 15 }) }), canDelete && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setDeleting(s), "aria-label": `حذف ${s.name}`, children: _jsx(Trash2, { size: 15 }) }))] }) })] }, s.id))) })] })) }), _jsx(SupplierDialog, { open: dialogOpen, onOpenChange: setDialogOpen, supplier: editing, onSaved: load }), _jsx(ConfirmDialog, { open: deleting !== null, onOpenChange: (open) => !open && setDeleting(null), title: `حذف "${deleting?.name}"؟`, description: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621.", onConfirm: () => deleting && remove(deleting) })] }));
}
