import type { Product } from '@pharmacy/shared-types';
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null means "add a new product". */
    product: Product | null;
    onSaved: () => void;
    onCloseAutoFocus?: (event: Event) => void;
}
export declare function ProductDialog({ open, onOpenChange, product, onSaved, onCloseAutoFocus }: Props): import("react").JSX.Element;
export {};
