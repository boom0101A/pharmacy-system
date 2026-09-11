/** Polls /health so a dead server shows up as a banner within seconds, not only on the next failed request. */
export declare function useConnectionPing(): () => Promise<void>;
