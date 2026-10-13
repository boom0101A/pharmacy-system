import { create } from 'zustand';
import type { Product } from '@pharmacy/shared-types';

export interface CartLine {
  productId: number;
  product: Product;
  quantity: number;
  isSubUnit: boolean;
}

interface CartState {
  lines: CartLine[];
  discount: number;
  setDiscount: (value: number) => void;
  add: (product: Product, quantity: number, isSubUnit?: boolean) => { capped: boolean };
  setQuantity: (productId: number, value: number, isSubUnit: boolean) => { capped: boolean };
  removeLine: (productId: number, isSubUnit: boolean) => void;
  clear: () => void;
  /** Re-clamps every line to the freshest stock figures — another till's sale can shrink what was available a moment ago. */
  syncAvailability: (products: Product[]) => void;
}

/**
 * Selling a sub-unit (e.g. one شريط) is capped by how many loose units the
 * catalogue's whole-package stock could still yield — the server resolves the
 * exact batch/opened-package bookkeeping at sale time; this is only the
 * client-side ceiling that keeps the cart honest before checkout.
 */
export function subUnitAvailability(product: Product): number {
  if (!product.unitsPerPackage) return 0;
  return product.stock * product.unitsPerPackage + product.looseSubUnits;
}

/**
 * A product's whole-box line and its strip line draw on one shared pool: the
 * server takes strips from loose stock first, then opens whole boxes. Capping
 * each line on its own let a cart hold 1 box + 10 strips out of a single box,
 * which only failed later, at checkout.
 */
function ceilingFor(product: Product, isSubUnit: boolean, lines: CartLine[]): number {
  const units = product.unitsPerPackage ?? 0;
  const otherQty = lines.find((l) => l.productId === product.id && l.isSubUnit !== isSubUnit)?.quantity ?? 0;
  if (isSubUnit) {
    if (!units) return 0;
    return Math.max(0, subUnitAvailability(product) - otherQty * units);
  }
  const boxesOpenedForStrips = units ? Math.ceil(Math.max(0, otherQty - product.looseSubUnits) / units) : 0;
  return Math.max(0, product.stock - boxesOpenedForStrips);
}

export function linePrice(line: CartLine): number {
  return line.isSubUnit ? (line.product.subUnitPrice ?? line.product.salePrice) : line.product.salePrice;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * linePrice(l), 0);
}

/** Whole dinars, never above the subtotal — the server rejects anything larger, and a discount past the subtotal used to turn later returns into negative refunds. */
function clampDiscount(value: number, lines: CartLine[]): number {
  return Math.min(Math.max(0, Math.round(value) || 0), cartSubtotal(lines));
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  discount: 0,

  setDiscount: (value) => set({ discount: clampDiscount(value, get().lines) }),

  add(product, quantity, isSubUnit = false) {
    const lines = get().lines;
    const ceiling = ceilingFor(product, isSubUnit, lines);
    const existing = lines.find((l) => l.productId === product.id && l.isSubUnit === isSubUnit);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const capped = wanted > ceiling;
    const next = Math.max(0, Math.min(wanted, ceiling));

    if (existing) {
      set({
        lines: lines.map((l) =>
          l.productId === product.id && l.isSubUnit === isSubUnit ? { ...l, product, quantity: next } : l,
        ),
      });
    } else if (next > 0) {
      set({ lines: [...lines, { productId: product.id, product, quantity: next, isSubUnit }] });
    }
    return { capped };
  },

  setQuantity(productId, value, isSubUnit) {
    const lines = get().lines;
    const line = lines.find((l) => l.productId === productId && l.isSubUnit === isSubUnit);
    if (!line) return { capped: false };

    const ceiling = ceilingFor(line.product, isSubUnit, lines);
    const capped = value > ceiling;
    const next = Math.max(0, Math.min(value, ceiling));

    // A zero-quantity line would fail the whole sale server-side (quantity
    // must be positive) with a generic "invalid data" message.
    const nextLines =
      next > 0
        ? lines.map((l) => (l.productId === productId && l.isSubUnit === isSubUnit ? { ...l, quantity: next } : l))
        : lines.filter((l) => !(l.productId === productId && l.isSubUnit === isSubUnit));
    set({ lines: nextLines, discount: clampDiscount(get().discount, nextLines) });
    return { capped };
  },

  removeLine(productId, isSubUnit) {
    const nextLines = get().lines.filter((l) => !(l.productId === productId && l.isSubUnit === isSubUnit));
    set({ lines: nextLines, discount: clampDiscount(get().discount, nextLines) });
  },

  clear() {
    set({ lines: [], discount: 0 });
  },

  syncAvailability(products) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const current = get().lines;
    const nextLines = current
      .map((l) => {
        const fresh = byId.get(l.productId);
        if (!fresh) return l;
        const ceiling = ceilingFor(fresh, l.isSubUnit, current);
        return { ...l, product: fresh, quantity: Math.min(l.quantity, ceiling) };
      })
      .filter((l) => l.quantity > 0);
    set({ lines: nextLines, discount: clampDiscount(get().discount, nextLines) });
  },
}));
