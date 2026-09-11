import type { ReactNode } from 'react';
interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    /**
     * Radix hands focus back to whatever opened the dialog. Callers that need it
     * somewhere else instead — the POS screen must return it to the barcode
     * field — can preventDefault here and place it themselves.
     */
    onCloseAutoFocus?: (event: Event) => void;
}
/**
 * Radix Dialog handles focus trapping, escape-to-close and the accessible
 * title/description wiring; everything visual comes from the CSS Module.
 */
export declare function Dialog({ open, onOpenChange, title, description, children, footer, onCloseAutoFocus, }: DialogProps): import("react").JSX.Element;
export {};
