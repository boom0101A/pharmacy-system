import type { User } from '@pharmacy/shared-types';
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null means "create a new user". */
    user: User | null;
    onSaved: () => void;
}
export declare function UserDialog({ open, onOpenChange, user, onSaved }: Props): import("react").JSX.Element;
export {};
