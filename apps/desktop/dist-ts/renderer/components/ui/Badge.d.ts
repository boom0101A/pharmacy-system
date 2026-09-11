import type { ReactNode } from 'react';
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
interface BadgeProps {
    tone?: BadgeTone;
    /**
     * A slow breathing pulse, for the row a pharmacist is scanning a long table
     * to find. Opt-in rather than automatic on `danger`: a table where every red
     * badge pulses is a table where none of them stands out.
     */
    pulse?: boolean;
    children: ReactNode;
}
export declare function Badge({ tone, pulse, children }: BadgeProps): import("react").JSX.Element;
export {};
