import type { Product } from '@pharmacy/shared-types';
interface Props {
    /** Non-null opens the dialog for that product. */
    product: Product | null;
    onClose: () => void;
    onSaved: () => void;
}
/**
 * Receiving stock creates a batch, not a bare quantity bump — each intake keeps
 * its own expiry date so the till can sell earliest-expiring stock first.
 */
export declare function ReceiveStockDialog({ product, onClose, onSaved }: Props): import("react").JSX.Element;
export {};
