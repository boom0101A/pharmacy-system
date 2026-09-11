import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Minus, Pencil, Pill, Plus, Printer, Repeat, ScanBarcode, ShoppingCart, Trash2, } from 'lucide-react';
import styles from './Pos.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { AlternativesDialog } from '../components/ui/AlternativesDialog';
import { ProductDialog } from './ProductDialog';
import { subUnitAvailability, useCart } from '../store/cart';
import { api, ApiError } from '../lib/api';
import { cleanIpcError, cx, formatMoney, playWarningBeep, productImageUrl } from '../lib/cx';
import { useAuth } from '../store/auth';
import { useStockVersion } from '../store/stockSync';
import { useConnection } from '../store/connection';
/**
 * A cart line's quantity used to be a read-only <span> next to +/- buttons —
 * now it is directly editable, with Enter committing the typed value.
 */
function QuantityInput({ value, onCommit, }) {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);
    function commit() {
        const parsed = Number(text);
        if (Number.isFinite(parsed) && parsed >= 0)
            onCommit(Math.floor(parsed));
        else
            setText(String(value));
    }
    function onKeyDown(event) {
        if (event.key === 'Enter') {
            commit();
            event.target.blur();
        }
    }
    return (_jsx("input", { className: styles.qtyInput, value: text, onChange: (e) => setText(e.target.value), onBlur: commit, onKeyDown: onKeyDown, inputMode: "numeric" }));
}
export function Pos() {
    const toast = useToast();
    const cart = useCart();
    const user = useAuth((s) => s.user);
    const canEdit = user?.role === 'admin' || user?.role === 'pharmacist';
    const stockVersion = useStockVersion((s) => s.version);
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editing, setEditing] = useState(null);
    const [alternativesFor, setAlternativesFor] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [lastReceipt, setLastReceipt] = useState(null);
    const [printing, setPrinting] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const scanRef = useRef(null);
    const online = useConnection((s) => s.online);
    // Held across retries of the same cart, and dropped the moment the cart
    // changes — replaying an old key after an edit would return the pre-edit
    // invoice and silently discard the change.
    const attemptKey = useRef(null);
    // A ref, not state: the onBlur that fires the instant the dialog opens still
    // holds the previous render's closure, so a state flag would read stale.
    const dialogOpenRef = useRef(false);
    // The key handler below is deliberately not re-armed on every search result,
    // so it reads these through refs rather than a stale closure.
    const productsRef = useRef(products);
    productsRef.current = products;
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;
    /**
     * The cart line that just changed, so it can play its flash animation once.
     * Cleared on a timer rather than animationend: scanning the same item twice
     * in quick succession has to replay the flash, and re-setting the same key
     * would otherwise be a no-op React skips.
     */
    const [flashedLine, setFlashedLine] = useState(null);
    const flashTimer = useRef(0);
    const flashLine = (key) => {
        window.clearTimeout(flashTimer.current);
        setFlashedLine(null);
        // Next frame, so a repeat scan restarts the animation instead of continuing it.
        requestAnimationFrame(() => setFlashedLine(key));
        flashTimer.current = window.setTimeout(() => setFlashedLine(null), 400);
    };
    useEffect(() => () => window.clearTimeout(flashTimer.current), []);
    /**
     * The barcode reader types into whatever has focus, so the scan field has to
     * hold focus at all times — after a sale, after a click, after anything.
     * The one exception is while a dialog is open, or this would yank focus
     * straight back out of it and make its fields impossible to type in.
     */
    const refocus = () => {
        if (dialogOpenRef.current)
            return;
        const active = document.activeElement;
        if (active && active !== scanRef.current) {
            const tag = active.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
                return;
        }
        scanRef.current?.focus();
    };
    useEffect(() => {
        refocus();
    }, []);
    // Debounced catalogue search; a scanner submits before this ever fires.
    useEffect(() => {
        const timer = setTimeout(() => {
            api
                .products(query.trim() || undefined, { limit: 48 })
                .then((fresh) => {
                setProducts(fresh);
                cart.syncAvailability(fresh);
            })
                .catch((err) => toast.error('تعذّر تحميل الأصناف', err.message))
                .finally(() => setLoadingProducts(false));
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, 200);
        return () => clearTimeout(timer);
    }, [query, toast, stockVersion, reloadKey]);
    // A new set of results invalidates the old position.
    useEffect(() => {
        setActiveIndex(null);
    }, [products]);
    useEffect(() => {
        if (activeIndex === null)
            return;
        document
            .querySelector(`[data-product-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);
    function addProduct(product, isSubUnit = false) {
        setLastReceipt(null);
        const available = isSubUnit ? subUnitAvailability(product) : product.stock;
        if (available <= 0) {
            toast.error('نفدت الكمية', `لا يوجد مخزون من "${product.name}"`);
            return;
        }
        const { capped } = cart.add(product, 1, isSubUnit);
        if (capped) {
            playWarningBeep();
            toast.error('الكمية بالسلة وصلت للحد الأقصى', `لا يوجد مخزون إضافي من "${product.name}"`);
        }
        else {
            // Scanning is a blind, heads-down motion — the cashier is looking at the
            // counter, not the screen. The line flashing on its way in is the cheapest
            // way to confirm the scan landed on the *right* row when they do look up.
            flashLine(`${product.id}-${isSubUnit}`);
        }
        refocus();
    }
    function commitQuantity(productId, value, isSubUnit) {
        const { capped } = cart.setQuantity(productId, value, isSubUnit);
        if (capped) {
            playWarningBeep();
            toast.error('الكمية المطلوبة أكبر من المتوفر', 'عُدّلت إلى أقصى ما يسمح به المخزون');
        }
    }
    /** Enter in the scan field means a barcode was just read. */
    async function handleScan(event) {
        event.preventDefault();
        const highlighted = activeIndex === null ? null : products[activeIndex];
        if (highlighted) {
            addProduct(highlighted);
            setQuery('');
            setActiveIndex(null);
            return;
        }
        const code = query.trim();
        if (!code)
            return;
        try {
            const product = await api.productByBarcode(code);
            addProduct(product);
            setQuery('');
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                try {
                    const matches = await api.products(code);
                    setProducts(matches);
                    if (matches.length === 1) {
                        addProduct(matches[0]);
                        setQuery('');
                    }
                }
                catch (searchErr) {
                    toast.error('خطأ', searchErr.message);
                }
                return;
            }
            toast.error('خطأ', err.message);
        }
    }
    useEffect(() => {
        attemptKey.current = null;
    }, [cart.lines, cart.discount]);
    async function checkout() {
        if (cart.lines.length === 0 || submitting)
            return;
        setSubmitting(true);
        attemptKey.current ??= crypto.randomUUID();
        try {
            const sale = await api.createSale({
                items: cart.lines.map((l) => ({
                    productId: l.productId,
                    quantity: l.quantity,
                    isSubUnit: l.isSubUnit,
                })),
                discount: cart.discount,
                idempotencyKey: attemptKey.current,
            });
            toast.success(`تمت الفاتورة رقم ${sale.id}`, `الإجمالي ${formatMoney(sale.total)}`);
            setLastReceipt({
                saleId: sale.id,
                date: sale.date,
                cashierName: user?.name ?? '',
                items: cart.lines.map((l) => ({
                    productName: l.product.name,
                    quantity: l.quantity,
                    unitPrice: l.isSubUnit ? (l.product.subUnitPrice ?? l.product.salePrice) : l.product.salePrice,
                    unitLabel: l.isSubUnit ? (l.product.subUnitName ?? 'وحدة') : l.product.unit,
                })),
                discount: cart.discount,
                total: sale.total,
            });
            cart.clear();
            setReloadKey((k) => k + 1);
            refocus();
        }
        catch (err) {
            toast.error('تعذّر إتمام البيع', err.message);
        }
        finally {
            setSubmitting(false);
        }
    }
    async function printLastReceipt() {
        if (!lastReceipt)
            return;
        setPrinting(true);
        try {
            await window.pharmacy.printReceipt(lastReceipt);
        }
        catch (err) {
            toast.error('تعذّر الطباعة', cleanIpcError(err.message));
        }
        finally {
            setPrinting(false);
        }
    }
    /**
     * A busy till lives on the keyboard, not the mouse: F12 completes the sale,
     * F4 jumps to the discount box, Esc drops the current invoice. Suppressed
     * while a dialog is open so it can keep Escape for itself.
     *
     * Registered in the CAPTURE phase, and that is load-bearing. Radix listens
     * for Escape on `document`; bubbling reaches `document` before `window`, so
     * a bubble-phase listener here would run *after* the dialog's own close
     * handler had already set dialogOpenRef back to false — and Escape would
     * both close the dialog and wipe the cart. Capture runs window-first, while
     * the guard is still raised.
     */
    useEffect(() => {
        function onKeyDown(event) {
            if (dialogOpenRef.current)
                return;
            if (event.key === 'F12') {
                event.preventDefault();
                if (!submitting && online)
                    checkout();
            }
            else if (event.key === 'F4') {
                event.preventDefault();
                document.getElementById('discount')?.focus();
            }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                // Only while the scan field holds focus. Anywhere else these keys still
                // belong to whatever is focused — the cart's number inputs step their
                // value with them, and stealing that would break quantity editing.
                if (document.activeElement !== scanRef.current)
                    return;
                const list = productsRef.current;
                if (list.length === 0)
                    return;
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                const from = activeIndexRef.current;
                const next = from === null ? (step === 1 ? 0 : list.length - 1) : from + step;
                setActiveIndex(((next % list.length) + list.length) % list.length);
            }
            else if (event.key === 'Escape' && activeIndexRef.current !== null) {
                // Escape drops the highlight first. Only a second press reaches the
                // cart below — otherwise dismissing a highlight would wipe the invoice.
                event.preventDefault();
                setActiveIndex(null);
            }
            else if (event.key === 'Escape' && cart.lines.length > 0) {
                event.preventDefault();
                cart.clear();
                refocus();
            }
        }
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitting, online, cart.lines.length]);
    const total = cart.lines.reduce((sum, l) => {
        const price = l.isSubUnit ? (l.product.subUnitPrice ?? l.product.salePrice) : l.product.salePrice;
        return sum + price * l.quantity;
    }, 0);
    const grandTotal = Math.max(0, total - cart.discount);
    return (_jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.left, children: [_jsxs("form", { className: styles.scanBar, onSubmit: handleScan, children: [_jsx(ScanBarcode, { className: styles.scanIcon, size: 22 }), _jsx("input", { ref: scanRef, className: styles.scanInput, value: query, onChange: (e) => setQuery(e.target.value), onBlur: () => setTimeout(refocus, 0), placeholder: "\u0627\u0645\u0633\u062D \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0623\u0648 \u0627\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645\u2026", "aria-label": "\u0628\u062D\u062B \u0623\u0648 \u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F" })] }), _jsxs("div", { className: styles.results, children: [loadingProducts &&
                                Array.from({ length: 8 }, (_, i) => (_jsxs("div", { className: styles.productSkeleton, children: [_jsx(Skeleton, { height: "7rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { width: "70%", height: "1rem" }), _jsx(Skeleton, { width: "40%", height: "0.875rem" })] }, `skeleton-${i}`))), !loadingProducts &&
                                products.map((product, index) => (_jsxs("div", { "data-product-index": index, className: cx(styles.productCard, index === activeIndex && styles.productCardActive), children: [_jsxs("button", { className: styles.productMain, onClick: () => addProduct(product), disabled: product.stock <= 0, children: [_jsx("span", { className: styles.productThumb, children: product.imageFilename ? (_jsx("img", { src: productImageUrl(product.imageFilename), alt: "" })) : (_jsx(Pill, { size: 22, strokeWidth: 1.5 })) }), _jsx("span", { className: styles.productName, children: product.name }), _jsx("span", { className: styles.lineUnitPrice, children: product.unit }), _jsxs("span", { className: styles.productMeta, children: [_jsx("span", { className: `${styles.productPrice} numeric`, children: formatMoney(product.salePrice) }), product.stock <= 0 ? (_jsx(Badge, { tone: "danger", children: "\u0646\u0641\u062F" })) : product.stock <= product.reorderLevel ? (_jsxs(Badge, { tone: "warning", children: [product.stock, " \u0645\u062A\u0628\u0642\u064D"] })) : (_jsx(Badge, { tone: "success", children: product.stock }))] })] }), canEdit && (_jsx("button", { className: styles.editButton, onClick: () => {
                                                dialogOpenRef.current = true;
                                                setEditing(product);
                                            }, "aria-label": `تعديل ${product.name}`, children: _jsx(Pencil, { size: 14 }) })), product.unitsPerPackage && product.subUnitPrice !== null && (_jsxs("button", { type: "button", className: styles.subUnitButton, onClick: () => addProduct(product, true), disabled: subUnitAvailability(product) <= 0, children: [_jsx(Plus, { size: 12 }), product.subUnitName, " \u00B7 ", formatMoney(product.subUnitPrice)] })), product.stock <= 0 && product.activeIngredient && (_jsxs("button", { type: "button", className: styles.alternativesButton, onClick: () => {
                                                dialogOpenRef.current = true;
                                                setAlternativesFor(product);
                                            }, children: [_jsx(Repeat, { size: 12 }), "\u0639\u0631\u0636 \u0627\u0644\u0628\u062F\u0627\u0626\u0644 \u0627\u0644\u0645\u062A\u0648\u0641\u0631\u0629"] }))] }, product.id)))] })] }), _jsxs("aside", { className: styles.cart, children: [_jsxs("div", { className: styles.cartHeader, children: [_jsx("h2", { className: styles.cartTitle, children: "\u0627\u0644\u0633\u0644\u0629" }), cart.lines.length > 0 && (_jsx("button", { type: "button", className: styles.clearCart, onClick: () => {
                                    cart.clear();
                                    refocus();
                                }, children: "\u062A\u0641\u0631\u064A\u063A" }))] }), cart.lines.length === 0 ? (_jsxs("div", { className: styles.emptyCart, children: [_jsx(ShoppingCart, { size: 32, strokeWidth: 1.5 }), _jsx("span", { children: "\u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F \u0635\u0646\u0641 \u0644\u0628\u062F\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629" })] })) : (_jsx("div", { className: styles.cartLines, children: cart.lines.map((line) => {
                            const price = line.isSubUnit
                                ? (line.product.subUnitPrice ?? line.product.salePrice)
                                : line.product.salePrice;
                            const lineKey = `${line.productId}-${line.isSubUnit}`;
                            return (_jsxs("div", { className: cx(styles.cartLine, flashedLine === lineKey && styles.cartLineFlash), children: [_jsxs("div", { className: styles.cartLineInfo, children: [_jsx("span", { className: styles.cartLineName, children: line.product.name }), line.isSubUnit && (_jsx("span", { className: styles.lineUnitBadge, children: line.product.subUnitName })), _jsx("span", { className: cx(styles.cartLinePrice, 'numeric'), children: formatMoney(price) })] }), _jsxs("div", { className: styles.cartLineControls, children: [_jsx("button", { type: "button", onClick: () => commitQuantity(line.productId, line.quantity - 1, line.isSubUnit), "aria-label": "\u0625\u0646\u0642\u0627\u0635", children: _jsx(Minus, { size: 14 }) }), _jsx(QuantityInput, { value: line.quantity, onCommit: (v) => commitQuantity(line.productId, v, line.isSubUnit) }), _jsx("button", { type: "button", onClick: () => commitQuantity(line.productId, line.quantity + 1, line.isSubUnit), "aria-label": "\u0632\u064A\u0627\u062F\u0629", children: _jsx(Plus, { size: 14 }) }), _jsx("button", { type: "button", className: styles.removeLine, onClick: () => cart.removeLine(line.productId, line.isSubUnit), "aria-label": "\u062D\u0630\u0641 \u0627\u0644\u0633\u0637\u0631", children: _jsx(Trash2, { size: 14 }) })] })] }, lineKey));
                        }) })), _jsxs("div", { className: styles.discountRow, children: [_jsx("label", { htmlFor: "discount", children: "\u0627\u0644\u062E\u0635\u0645" }), _jsx("input", { id: "discount", className: styles.discountInput, type: "number", min: 0, value: cart.discount || '', placeholder: "0", onChange: (e) => cart.setDiscount(Number(e.target.value) || 0) })] }), _jsxs("div", { className: styles.totalRow, children: [_jsx("span", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }), _jsxs("span", { className: "numeric", children: [formatMoney(grandTotal), " \u062F.\u0639"] })] }), _jsx(Button, { size: "xl", fullWidth: true, onClick: checkout, disabled: cart.lines.length === 0 || submitting || !online, children: submitting ? 'جارٍ التنفيذ…' : 'إتمام البيع' }), lastReceipt && (_jsxs("div", { className: styles.lastReceipt, children: [_jsx(CheckCircle2, { size: 32, strokeWidth: 1.5, className: styles.lastReceiptIcon }), _jsxs("span", { children: ["\u062A\u0645\u062A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645 ", lastReceipt.saleId] }), _jsxs(Button, { variant: "outline", onClick: printLastReceipt, disabled: printing, children: [_jsx(Printer, { size: 16 }), printing ? 'جارٍ الطباعة…' : 'طباعة'] })] }))] }), _jsx(ProductDialog, { open: editing !== null, product: editing, onOpenChange: (open) => {
                    dialogOpenRef.current = open;
                    if (!open) {
                        setEditing(null);
                        refocus();
                    }
                }, onSaved: () => setReloadKey((k) => k + 1), onCloseAutoFocus: (e) => e.preventDefault() }), _jsx(AlternativesDialog, { product: alternativesFor, onClose: () => {
                    dialogOpenRef.current = false;
                    setAlternativesFor(null);
                    refocus();
                }, onPick: async (id) => {
                    dialogOpenRef.current = false;
                    setAlternativesFor(null);
                    // The alternatives list carries only display fields — fetch the
                    // full product record before it can be added to the cart.
                    const alreadyLoaded = products.find((p) => p.id === id);
                    const full = alreadyLoaded ?? (await api.products().then((rows) => rows.find((p) => p.id === id)));
                    if (full)
                        addProduct(full);
                    refocus();
                } })] }));
}
