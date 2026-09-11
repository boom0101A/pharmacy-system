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
  return product.stock * product.unitsPerPackage;
}

function ceilingFor(product: Product, isSubUnit: boolean): number {
  return isSubUnit ? subUnitAvailability(product) : product.stock;
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  discount: 0,

  setDiscount: (value) => set({ discount: Math.max(0, value) }),

  add(product, quantity, isSubUnit = false) {
    const ceiling = ceilingFor(product, isSubUnit);
    const lines = get().lines;
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

    const ceiling = ceilingFor(line.product, isSubUnit);
    const capped = value > ceiling;
    const next = Math.max(0, Math.min(value, ceiling));

    set({
      lines: lines.map((l) =>
        l.productId === productId && l.isSubUnit === isSubUnit ? { ...l, quantity: next } : l,
      ),
    });
    return { capped };
  },

  removeLine(productId, isSubUnit) {
    set({
      lines: get().lines.filter((l) => !(l.productId === productId && l.isSubUnit === isSubUnit)),
    });
  },

  clear() {
    set({ lines: [], discount: 0 });
  },

  syncAvailability(products) {
    const byId = new Map(products.map((p) => [p.id, p]));
    set({
      lines: get()
        .lines.map((l) => {
          const fresh = byId.get(l.productId);
          if (!fresh) return l;
          const ceiling = ceilingFor(fresh, l.isSubUnit);
          return { ...l, product: fresh, quantity: Math.min(l.quantity, ceiling) };
        })
        .filter((l) => l.quantity > 0),
    });
  },
}));
