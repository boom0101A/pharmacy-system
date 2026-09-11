import type { Supplier } from '@pharmacy/shared-types';
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
    onSaved: () => void;
}
export declare function SupplierDialog({ open, onOpenChange, supplier, onSaved }: Props): import("react").JSX.Element;
export {};
