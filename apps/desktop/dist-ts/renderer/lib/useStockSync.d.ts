/** Connects to the server's stock-change broadcast only while `enabled` (i.e. once logged in) — no point listening before there's anything to react to. */
export declare function useStockSync(enabled: boolean): void;
