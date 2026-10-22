import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Minus,
  Pencil,
  Pill,
  Plus,
  Printer,
  Repeat,
  ScanBarcode,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import type { Product, ReceiptData } from '@pharmacy/shared-types';
import styles from './Pos.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { AlternativesDialog } from '../components/ui/AlternativesDialog';
import { ProductDialog } from './ProductDialog';
import { subUnitAvailability, useCart } from '../store/cart';
import { api, ApiError } from '../lib/api';
import { findAlternativeProduct } from '../lib/alternativePick';
import { parsePriceInput, reformatPriceInput } from '../lib/priceInput';
import { usePosProductsHidden } from '../lib/usePosProductsHidden';
import { EmptyState } from '../components/ui/EmptyState';
import { cleanIpcError, cx, formatMoney, productImageUrl } from '../lib/cx';
import { playSaleComplete, playWarningBeep } from '../lib/sounds.js';
import { useAuth } from '../store/auth';
import { useStockVersion } from '../store/stockSync';
import { useConnection } from '../store/connection';

/**
 * A cart line's quantity used to be a read-only <span> next to +/- buttons —
 * now it is directly editable, with Enter committing the typed value.
 */
function QuantityInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  function commit() {
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed >= 0) onCommit(Math.floor(parsed));
    else setText(String(value));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commit();
      (event.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      className={styles.qtyInput}
      aria-label="الكمية"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      inputMode="numeric"
    />
  );
}

export function Pos() {
  const toast = useToast();
  const cart = useCart();
  const user = useAuth((s) => s.user);
  const canEdit = user?.role === 'admin' || user?.role === 'pharmacist';
  const stockVersion = useStockVersion((s) => s.version);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [alternativesFor, setAlternativesFor] = useState<Product | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printing, setPrinting] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const online = useConnection((s) => s.online);
  // Held across retries of the same cart, and dropped the moment the cart
  // changes — replaying an old key after an edit would return the pre-edit
  // invoice and silently discard the change.
  const attemptKey = useRef<string | null>(null);
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
  const [flashedLine, setFlashedLine] = useState<string | null>(null);
  const flashTimer = useRef(0);

  const flashLine = (key: string) => {
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
    if (dialogOpenRef.current) return;
    const active = document.activeElement;
    if (active && active !== scanRef.current) {
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    }
    scanRef.current?.focus();
  };

  useEffect(() => {
    refocus();
  }, []);

  // Hidden only from view: the catalogue fetch below still runs, because its
  // results keep the cart's available quantities in sync.
  const [productsHidden, toggleProductsHidden] = usePosProductsHidden();
  const gridVisible = !productsHidden || query.trim() !== '';
  const gridVisibleRef = useRef(gridVisible);
  gridVisibleRef.current = gridVisible;

  // Debounced catalogue search; a scanner submits before this ever fires.
  useEffect(() => {
    // An older search that answers last must not replace the newer results.
    let current = true;
    const timer = setTimeout(() => {
      api
        .products(query.trim() || undefined, { limit: 48 })
        .then((fresh) => {
          if (!current) return;
          setProducts(fresh);
          cart.syncAvailability(fresh);
        })
        .catch((err: Error) => current && toast.error('تعذّر تحميل الأصناف', err.message))
        .finally(() => current && setLoadingProducts(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, toast, stockVersion, reloadKey]);

  // A new set of results invalidates the old position.
  useEffect(() => {
    setActiveIndex(null);
  }, [products]);

  useEffect(() => {
    if (activeIndex === null) return;
    document
      .querySelector<HTMLElement>(`[data-product-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function addProduct(product: Product, isSubUnit = false) {
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
    } else {
      // Scanning is a blind, heads-down motion — the cashier is looking at the
      // counter, not the screen. The line flashing on its way in is the cheapest
      // way to confirm the scan landed on the *right* row when they do look up.
      flashLine(`${product.id}-${isSubUnit}`);
    }
    refocus();
  }

  function commitQuantity(productId: number, value: number, isSubUnit: boolean) {
    const { capped } = cart.setQuantity(productId, value, isSubUnit);
    if (capped) {
      playWarningBeep();
      toast.error('الكمية المطلوبة أكبر من المتوفر', 'عُدّلت إلى أقصى ما يسمح به المخزون');
    }
  }

  /** Enter in the scan field means a barcode was just read. */
  async function handleScan(event: FormEvent) {
    event.preventDefault();

    const highlighted = activeIndex === null ? null : products[activeIndex];
    if (highlighted) {
      addProduct(highlighted);
      setQuery('');
      setActiveIndex(null);
      return;
    }

    const code = query.trim();
    if (!code) return;

    try {
      const product = await api.productByBarcode(code);
      addProduct(product);
      setQuery('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        try {
          const matches = await api.products(code);
          setProducts(matches);
          if (matches.length === 1) {
            addProduct(matches[0]);
            setQuery('');
          }
        } catch (searchErr) {
          toast.error('خطأ', (searchErr as Error).message);
        }
        return;
      }
      toast.error('خطأ', (err as Error).message);
    }
  }

  useEffect(() => {
    attemptKey.current = null;
  }, [cart.lines, cart.discount]);

  async function checkout() {
    // Read fresh, not from this render's closure: the F12 key handler keeps
    // an older `checkout` until the line *count* changes, so a quantity or
    // discount edited since then would otherwise be silently dropped.
    const { lines, discount } = useCart.getState();
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    attemptKey.current ??= crypto.randomUUID();
    try {
      const sale = await api.createSale({
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          isSubUnit: l.isSubUnit,
        })),
        discount,
        idempotencyKey: attemptKey.current,
      });
      toast.success(`تمت الفاتورة رقم ${sale.id}`, `الإجمالي ${formatMoney(sale.total)}`, { silent: true });
      playSaleComplete();
      setLastReceipt({
        saleId: sale.id,
        date: sale.date,
        cashierName: user?.name ?? '',
        items: lines.map((l) => ({
          productName: l.product.name,
          quantity: l.quantity,
          unitPrice: l.isSubUnit ? (l.product.subUnitPrice ?? l.product.salePrice) : l.product.salePrice,
          unitLabel: l.isSubUnit ? (l.product.subUnitName ?? 'وحدة') : l.product.unit,
        })),
        discount,
        total: sale.total,
      });
      cart.clear();
      setReloadKey((k) => k + 1);
      refocus();
    } catch (err) {
      toast.error('تعذّر إتمام البيع', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function printLastReceipt() {
    if (!lastReceipt) return;
    setPrinting(true);
    try {
      await window.pharmacy.printReceipt(lastReceipt);
    } catch (err) {
      toast.error('تعذّر الطباعة', cleanIpcError((err as Error).message));
    } finally {
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
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (dialogOpenRef.current) return;

      if (event.key === 'F8') {
        event.preventDefault();
        toggleProductsHidden();
        refocus();
      } else if (event.key === 'F12') {
        event.preventDefault();
        if (!submitting && online) checkout();
      } else if (event.key === 'F4') {
        event.preventDefault();
        document.getElementById('discount')?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        // Only while the scan field holds focus. Anywhere else these keys still
        // belong to whatever is focused — the cart's number inputs step their
        // value with them, and stealing that would break quantity editing.
        if (document.activeElement !== scanRef.current || !gridVisibleRef.current) return;
        const list = productsRef.current;
        if (list.length === 0) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const from = activeIndexRef.current;
        const next = from === null ? (step === 1 ? 0 : list.length - 1) : from + step;
        setActiveIndex(((next % list.length) + list.length) % list.length);
      } else if (event.key === 'Escape' && activeIndexRef.current !== null) {
        // Escape drops the highlight first. Only a second press reaches the
        // cart below — otherwise dismissing a highlight would wipe the invoice.
        event.preventDefault();
        setActiveIndex(null);
      } else if (event.key === 'Escape' && cart.lines.length > 0) {
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

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <div className={styles.scanRow}>
          <form className={styles.scanBar} onSubmit={handleScan}>
            <ScanBarcode className={styles.scanIcon} size={22} />
            <input
              ref={scanRef}
              className={styles.scanInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(refocus, 0)}
              placeholder="امسح الباركود أو ابحث بالاسم…"
              aria-label="بحث أو مسح باركود"
            />
          </form>
          <button
            type="button"
            className={styles.hideToggle}
            aria-pressed={productsHidden}
            title="F8"
            onClick={() => {
              toggleProductsHidden();
              refocus();
            }}
          >
            {productsHidden ? <Eye size={18} /> : <EyeOff size={18} />}
            {productsHidden ? 'إظهار الأدوية' : 'إخفاء الأدوية'}
          </button>
        </div>

        {!gridVisible ? (
          <EmptyState
            icon={<ScanBarcode size={28} />}
            title="الأدوية مخفية"
            description="امسح الباركود أو اكتب اسم الدواء في الخانة أعلاه"
          />
        ) : (
          <div className={styles.results}>
            {loadingProducts &&
              Array.from({ length: 8 }, (_, i) => (
                <div key={`skeleton-${i}`} className={styles.productSkeleton}>
                  <Skeleton height="7rem" radius="var(--radius-md)" />
                  <Skeleton width="70%" height="1rem" />
                  <Skeleton width="40%" height="0.875rem" />
                </div>
              ))}

            {!loadingProducts &&
              products.map((product, index) => (
                <div
                  key={product.id}
                  data-product-index={index}
                  className={cx(styles.productCard, index === activeIndex && styles.productCardActive)}
                >
                  <button
                    className={styles.productMain}
                    onClick={() => addProduct(product)}
                    disabled={product.stock <= 0}
                  >
                    <span className={styles.productThumb}>
                      {product.imageFilename ? (
                        <img src={productImageUrl(product.imageFilename)!} alt="" />
                      ) : (
                        <Pill size={22} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className={styles.productName}>{product.name}</span>
                    <span className={cx(styles.lineUnitPrice, !product.categoryName && styles.categoryMissing)}>
                      {product.categoryName ?? 'بدون تصنيف'}
                    </span>
                    <span className={styles.productMeta}>
                      <span className={`${styles.productPrice} numeric`}>
                        {formatMoney(product.salePrice)}
                      </span>
                      {product.stock <= 0 && product.looseSubUnits > 0 ? (
                        <Badge tone="warning">
                          {product.looseSubUnits} {product.subUnitName ?? "وحدة"}
                        </Badge>
                      ) : product.stock <= 0 ? (
                        <Badge tone="danger">نفد</Badge>
                      ) : product.stock <= product.reorderLevel ? (
                        <Badge tone="warning">{product.stock} متبقٍ</Badge>
                      ) : (
                        <Badge tone="success">{product.stock}</Badge>
                      )}
                    </span>
                  </button>

                  {canEdit && (
                    <button
                      className={styles.editButton}
                      onClick={() => {
                        dialogOpenRef.current = true;
                        setEditing(product);
                      }}
                      aria-label={`تعديل ${product.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  {product.unitsPerPackage && product.subUnitPrice !== null && (
                    <button
                      type="button"
                      className={styles.subUnitButton}
                      onClick={() => addProduct(product, true)}
                      disabled={subUnitAvailability(product) <= 0}
                    >
                      <Plus size={12} />
                      {product.subUnitName} · {formatMoney(product.subUnitPrice)}
                    </button>
                  )}

                  {product.stock <= 0 && product.activeIngredient && (
                    <button
                      type="button"
                      className={styles.alternativesButton}
                      onClick={() => {
                        dialogOpenRef.current = true;
                        setAlternativesFor(product);
                      }}
                    >
                      <Repeat size={12} />
                      عرض البدائل المتوفرة
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <aside className={styles.cart}>
        <div className={styles.cartHeader}>
          <h2 className={styles.cartTitle}>السلة</h2>
          {cart.lines.length > 0 && (
            <button
              type="button"
              className={styles.clearCart}
              onClick={() => {
                cart.clear();
                refocus();
              }}
            >
              تفريغ
            </button>
          )}
        </div>

        {cart.lines.length === 0 ? (
          <div className={styles.emptyCart}>
            <ShoppingCart size={32} strokeWidth={1.5} />
            <span>امسح باركود صنف لبدء الفاتورة</span>
          </div>
        ) : (
          <div className={styles.cartLines}>
            {cart.lines.map((line) => {
              const price = line.isSubUnit
                ? (line.product.subUnitPrice ?? line.product.salePrice)
                : line.product.salePrice;
              const lineKey = `${line.productId}-${line.isSubUnit}`;
              return (
                <div
                  key={lineKey}
                  className={cx(styles.cartLine, flashedLine === lineKey && styles.cartLineFlash)}
                >
                  <div className={styles.cartLineInfo}>
                    <span className={styles.cartLineName}>{line.product.name}</span>
                    {line.isSubUnit && (
                      <span className={styles.lineUnitBadge}>{line.product.subUnitName}</span>
                    )}
                    <span className={cx(styles.cartLinePrice, 'numeric')}>{formatMoney(price)}</span>
                  </div>
                  <div className={styles.cartLineControls}>
                    <button
                      type="button"
                      onClick={() => commitQuantity(line.productId, line.quantity - 1, line.isSubUnit)}
                      aria-label="إنقاص"
                    >
                      <Minus size={14} />
                    </button>
                    <QuantityInput
                      value={line.quantity}
                      onCommit={(v) => commitQuantity(line.productId, v, line.isSubUnit)}
                    />
                    <button
                      type="button"
                      onClick={() => commitQuantity(line.productId, line.quantity + 1, line.isSubUnit)}
                      aria-label="زيادة"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.removeLine}
                      onClick={() => cart.removeLine(line.productId, line.isSubUnit)}
                      aria-label="حذف السطر"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.discountRow}>
          <label htmlFor="discount">الخصم</label>
          <input
            id="discount"
            className={styles.discountInput}
            inputMode="numeric"
            dir="ltr"
            value={cart.discount ? formatMoney(cart.discount) : ''}
            placeholder="0"
            onChange={(e) => cart.setDiscount(parsePriceInput(reformatPriceInput(e.target.value, 0).formatted) ?? 0)}
          />
        </div>

        <div className={styles.totalRow}>
          <span>الإجمالي</span>
          <span className="numeric">{formatMoney(grandTotal)} د.ع</span>
        </div>

        <Button
          size="xl"
          fullWidth
          onClick={checkout}
          disabled={cart.lines.length === 0 || submitting || !online}
        >
          {submitting ? 'جارٍ التنفيذ…' : 'إتمام البيع'}
        </Button>

        {lastReceipt && (
          <div className={styles.lastReceipt}>
            <CheckCircle2 size={32} strokeWidth={1.5} className={styles.lastReceiptIcon} />
            <span>تمت الفاتورة رقم {lastReceipt.saleId}</span>
            <Button variant="outline" onClick={printLastReceipt} disabled={printing}>
              <Printer size={16} />
              {printing ? 'جارٍ الطباعة…' : 'طباعة'}
            </Button>
          </div>
        )}
      </aside>

      <ProductDialog
        open={editing !== null}
        product={editing}
        onOpenChange={(open) => {
          dialogOpenRef.current = open;
          if (!open) {
            setEditing(null);
            refocus();
          }
        }}
        onSaved={() => setReloadKey((k) => k + 1)}
        onCloseAutoFocus={(e) => e.preventDefault()}
      />

      <AlternativesDialog
        product={alternativesFor}
        onClose={() => {
          dialogOpenRef.current = false;
          setAlternativesFor(null);
          refocus();
        }}
        onPick={async (id) => {
          dialogOpenRef.current = false;
          setAlternativesFor(null);
          try {
            const full = await findAlternativeProduct(id, products, (productId) => api.productById(productId));
            if (full) addProduct(full);
            else toast.warning('تعذّر إيجاد الصنف المختار');
          } catch (err) {
            toast.error('تعذّر إيجاد الصنف المختار', cleanIpcError((err as Error).message));
          } finally {
            refocus();
          }
        }}
      />
    </div>
  );
}
