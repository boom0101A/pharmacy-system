import type { Product } from '@pharmacy/shared-types';
interface Props {
    /** Non-null opens the dialog for this sold-out product. */
    product: Product | null;
    onClose: () => void;
    onPick: (alternativeId: number) => void;
}
/** A dead end turned into a question worth asking: what else has the same active ingredient and is actually in stock. */
export declare function AlternativesDialog({ product, onClose, onPick }: Props): import("react").JSX.Element;
export {};
