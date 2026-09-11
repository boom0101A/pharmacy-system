export interface Settings {
    printerPath: string | null;
    /** Printed on the receipt header instead of the generic app name — the customer's actual pharmacy, not "نظام إدارة الصيدلية". */
    pharmacyName: string | null;
    pharmacyAddress: string | null;
    pharmacyPhone: string | null;
    /** The server's logo `updatedAt` last cached to disk here (see logo:sync in main.ts) — null means either no logo has ever synced, or the server has none. */
    logoCachedVersion: string | null;
}
export declare const settingsStore: {
    getAll(): Settings;
    setMany(patch: Partial<Settings>): void;
    get<K extends keyof Settings>(key: K): Settings[K];
    set<K extends keyof Settings>(key: K, value: Settings[K]): void;
};
