import type { Product } from '@pharmacy/shared-types';
interface ProductPickerProps {
    onSelect: (product: Product) => void;
    placeholder?: string;
}
/** A type-ahead product search — used wherever a line item needs a product (purchase invoices, batch receiving) without leaving the form to look one up. */
export declare function ProductPicker({ onSelect, placeholder }: ProductPickerProps): import("react").JSX.Element;
export {};
