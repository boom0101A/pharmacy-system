interface BrandingState {
    /** null = no logo uploaded — the sidebar/login screen fall back to the default icon. */
    logoUrl: string | null;
    refresh: () => Promise<void>;
}
export declare const useBranding: import("zustand").UseBoundStore<import("zustand").StoreApi<BrandingState>>;
export {};
