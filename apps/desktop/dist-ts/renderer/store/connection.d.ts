interface ConnectionState {
    online: boolean;
    setOnline: (online: boolean) => void;
}
export declare const useConnection: import("zustand").UseBoundStore<import("zustand").StoreApi<ConnectionState>>;
export {};
