import type { ReactNode } from 'react';
interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}
export declare function EmptyState({ icon, title, description, action }: EmptyStateProps): import("react").JSX.Element;
export {};
