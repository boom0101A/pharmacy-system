import { type ReactNode } from 'react';
interface ToastContextValue {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
}
export declare function ToastProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useToast(): ToastContextValue;
export {};
