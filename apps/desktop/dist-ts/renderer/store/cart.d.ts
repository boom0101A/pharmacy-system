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
    add: (product: Product, quantity: number, isSubUnit?: boolean) => {
        capped: boolean;
    };
    setQuantity: (productId: number, value: number, isSubUnit: boolean) => {
        capped: boolean;
    };
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
export declare function subUnitAvailability(product: Product): number;
export declare const useCart: import("zustand").UseBoundStore<import("zustand").StoreApi<CartState>>;
export {};
