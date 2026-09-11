import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import styles from './Inventory.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { ProductDialog } from './ProductDialog';
import { ReceiveStockDialog } from './ReceiveStockDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useStockVersion } from '../store/stockSync';
import { useToast } from '../components/ui/Toast';
import { formatDate, formatMoney } from '../lib/cx';
const PAGE_SIZE = 40;
const LOW_STOCK_ALERT_MS = 8000;
export function Inventory() {
    const toast = useToast();
    const { can } = useAuth();
    const canEdit = can('admin', 'pharmacist');
    const canDelete = can('admin');
    const stockVersion = useStockVersion((s) => s.version);
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [counts, setCounts] = useState({ total: 0, low: 0, expiring: 0, out: 0 });
    const [editing, setEditing] = useState(null);
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [receivingFor, setReceivingFor] = useState(null);
    const [deletingProduct, setDeletingProduct] = useState(null);
    // The low-stock banner greets you on arrival and then gets out of the way.
    const [lowStockAlertDone, setLowStockAlertDone] = useState(false);
    const load = useCallback(async (term, status) => {
        try {
            const query = term.trim() || undefined;
            const [page, stats] = await Promise.all([
                api.products(query, {
                    status: status === 'all' ? undefined : status,
                    limit: PAGE_SIZE,
                }),
                api.productStats(query),
            ]);
            setProducts(page);
            setCounts(stats);
        }
        catch (err) {
            toast.error('تعذّر تحميل المخزون', err.message);
        }
        finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => {
        const timer = setTimeout(() => load(search, statusFilter), 200);
        return () => clearTimeout(timer);
    }, [search, statusFilter, load, stockVersion]);
    useEffect(() => {
        // The banner's fade is CSS, but what removes it is this timer — and a
        // timer is something the global reduced-motion override in tokens.css
        // cannot reach. Without this check the banner would sit there, frozen
        // mid-animation, for the full eight seconds.
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = window.setTimeout(() => setLowStockAlertDone(true), reduced ? 0 : LOW_STOCK_ALERT_MS);
        return () => window.clearTimeout(timer);
    }, []);
    async function loadMore() {
        setLoadingMore(true);
        try {
            const more = await api.products(search.trim() || undefined, {
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: PAGE_SIZE,
                offset: products.length,
            });
            setProducts((prev) => [...prev, ...more]);
        }
        catch (err) {
            toast.error('تعذّر تحميل المزيد', err.message);
        }
        finally {
            setLoadingMore(false);
        }
    }
    // Lets the dashboard's stat cards deep-link straight into a filtered view.
    const [searchParams] = useSearchParams();
    useEffect(() => {
        const requested = searchParams.get('filter');
        if (requested === 'low' || requested === 'expiring' || requested === 'out') {
            setStatusFilter(requested);
        }
    }, [searchParams]);
    /**
     * F1 opens the new-medicine form, the same as the button. Held back while any
     * dialog is already up: it would stack a second one over an edit in progress
     * and throw away whatever had been typed into it.
     */
    useEffect(() => {
        if (!canEdit)
            return;
        const busy = productDialogOpen || receivingFor !== null || deletingProduct !== null;
        if (busy)
            return;
        function onKeyDown(event) {
            if (event.key !== 'F1')
                return;
            event.preventDefault();
            setEditing(null);
            setProductDialogOpen(true);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canEdit, productDialogOpen, receivingFor, deletingProduct]);
    const FILTERS = [
        { key: 'all', label: 'الكل', count: counts.total },
        { key: 'low', label: 'يحتاج إعادة طلب', count: counts.low },
        { key: 'expiring', label: 'قارب على الانتهاء', count: counts.expiring },
        { key: 'out', label: 'نفد', count: counts.out },
    ];
    const visible = products;
    /**
     * Built only when the rows themselves change, not on every keystroke in the
     * search box above — "load more" appends without any upper bound, so by late
     * in a shift this table can be long enough for that to matter.
     *
     * Safe to leave the handlers out of the dependency list: everything they
     * close over is either the row's own product or a `useState` setter, whose
     * identity React guarantees is stable.
     */
    const rows = useMemo(() => visible.map((product) => (_jsxs("tr", { children: [_jsxs("td", { className: styles.name, children: [product.name, product.barcode && _jsx("div", { className: styles.barcode, children: product.barcode })] }), _jsx("td", { children: product.categoryName ?? '—' }), _jsx("td", { className: "numeric", children: product.stock }), _jsx("td", { className: "numeric", children: formatMoney(product.salePrice) }), _jsx("td", { children: product.stock <= 0 ? (_jsx(Badge, { tone: "danger", pulse: true, children: "\u0646\u0641\u062F" })) : product.stock <= product.reorderLevel ? (_jsx(Badge, { tone: "warning", children: "\u064A\u062D\u062A\u0627\u062C \u0625\u0639\u0627\u062F\u0629 \u0637\u0644\u0628" })) : (_jsx(Badge, { tone: "success", children: "\u0645\u062A\u0648\u0641\u0631" })) }), _jsx("td", { children: formatDate(product.nearestExpiry) }), _jsx("td", { children: _jsxs("div", { className: styles.actions, children: [canEdit && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setReceivingFor(product), children: "\u0625\u062F\u062E\u0627\u0644 \u0643\u0645\u064A\u0629" })), canEdit && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                setEditing(product);
                                setProductDialogOpen(true);
                            }, "aria-label": `تعديل ${product.name}`, children: _jsx(Pencil, { size: 15 }) })), canDelete && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setDeletingProduct(product), "aria-label": `حذف ${product.name}`, children: _jsx(Trash2, { size: 15 }) }))] }) })] }, product.id))), [visible, canEdit, canDelete]);
    const shownCount = statusFilter === 'all' ? counts.total : counts[statusFilter];
    async function remove(product) {
        try {
            await api.deleteProduct(product.id);
            toast.success('تم حذف الصنف');
            load(search, statusFilter);
        }
        catch (err) {
            toast.error('تعذّر الحذف', err.message);
        }
        finally {
            setDeletingProduct(null);
        }
    }
    return (_jsxs(_Fragment, { children: [!lowStockAlertDone && counts.low > 0 && (_jsxs("div", { className: styles.lowStockBanner, children: [counts.low, " \u0635\u0646\u0641 \u064A\u062D\u062A\u0627\u062C \u0625\u0639\u0627\u062F\u0629 \u0637\u0644\u0628", _jsx("button", { type: "button", onClick: () => setLowStockAlertDone(true), "aria-label": "\u0625\u063A\u0644\u0627\u0642", children: "\u00D7" })] })), _jsxs("div", { className: styles.page, children: [_jsxs("div", { className: styles.toolbar, children: [_jsx("input", { className: styles.search, value: search, onChange: (e) => setSearch(e.target.value), placeholder: "\u0627\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F\u2026", "aria-label": "\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646" }), canEdit && (_jsx("div", { className: styles.spacer, children: _jsxs(Button, { onClick: () => {
                                        setEditing(null);
                                        setProductDialogOpen(true);
                                    }, title: "F1", children: [_jsx(Plus, { size: 16 }), "\u062F\u0648\u0627\u0621 \u062C\u062F\u064A\u062F"] }) }))] }), _jsx("div", { className: styles.filters, children: FILTERS.map((filter) => (_jsxs("button", { type: "button", className: filter.key === statusFilter ? styles.filterActive : styles.filter, onClick: () => setStatusFilter(filter.key), children: [filter.label, _jsx("span", { className: styles.filterCount, children: filter.count })] }, filter.key))) }), loading ? (_jsx("table", { className: styles.table, children: _jsx("tbody", { children: _jsx(SkeletonRows, { rows: 6, columns: 6 }) }) })) : visible.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Package, { size: 26 }), title: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u062F\u0648\u064A\u0629", description: search ? 'لا نتائج مطابقة لبحثك' : 'ابدأ بإضافة أول دواء للمخزون', action: search ? (_jsx(Button, { variant: "outline", onClick: () => setSearch(''), children: "\u0645\u0633\u062D \u0627\u0644\u0628\u062D\u062B" })) : statusFilter !== 'all' ? (_jsx(Button, { variant: "outline", onClick: () => setStatusFilter('all'), children: "\u0639\u0631\u0636 \u0643\u0644 \u0627\u0644\u0623\u062F\u0648\u064A\u0629" })) : (canEdit && (_jsxs(Button, { onClick: () => {
                                setEditing(null);
                                setProductDialogOpen(true);
                            }, children: [_jsx(Plus, { size: 16 }), "\u062F\u0648\u0627\u0621 \u062C\u062F\u064A\u062F"] }))) })) : (_jsxs("table", { className: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0627\u0644\u0635\u0646\u0641" }), _jsx("th", { children: "\u0627\u0644\u062A\u0635\u0646\u064A\u0641" }), _jsx("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629" }), _jsx("th", { children: "\u0627\u0644\u0633\u0639\u0631" }), _jsx("th", { children: "\u0627\u0644\u062D\u0627\u0644\u0629" }), _jsx("th", { children: "\u0623\u0642\u0631\u0628 \u0627\u0646\u062A\u0647\u0627\u0621" }), _jsx("th", {})] }) }), _jsx("tbody", { children: rows })] })), !loading && visible.length > 0 && visible.length < shownCount && (_jsxs("div", { className: styles.loadMoreRow, children: [_jsxs("span", { className: styles.shownCount, children: ["\u0639\u0631\u0636 ", visible.length, " \u0645\u0646 ", shownCount] }), _jsx(Button, { variant: "outline", onClick: loadMore, disabled: loadingMore, children: loadingMore ? 'جارٍ التحميل…' : 'تحميل المزيد' })] }))] }), _jsx(ProductDialog, { open: productDialogOpen, product: editing, onOpenChange: setProductDialogOpen, onSaved: () => load(search, statusFilter) }), _jsx(ReceiveStockDialog, { product: receivingFor, onClose: () => setReceivingFor(null), onSaved: () => load(search, statusFilter) }), _jsx(ConfirmDialog, { open: deletingProduct !== null, onOpenChange: (open) => !open && setDeletingProduct(null), title: `حذف "${deletingProduct?.name ?? ''}"؟`, description: deletingProduct && deletingProduct.stock > 0
                    ? `سيُحذف الدواء وكل دفعاته (${deletingProduct.stock} ${deletingProduct.unit} بالمخزون). لا يمكن التراجع. الدواء الذي بِيع سابقاً سيرفض النظام حذفه حفاظاً على سجلّ الفواتير.`
                    : 'لا يمكن التراجع عن هذا الإجراء.', onConfirm: () => deletingProduct && remove(deletingProduct) })] }));
}
