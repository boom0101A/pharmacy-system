interface StockVersionState {
    version: number;
    bump: () => void;
}
/**
 * Not the stock data itself — just a counter every screen's fetch effect
 * depends on, so a sale or receipt on another till invalidates every other
 * till's product list without the sockets code needing to know what a
 * "product" or "batch" even is.
 */
export declare const useStockVersion: import("zustand").UseBoundStore<import("zustand").StoreApi<StockVersionState>>;
export {};
