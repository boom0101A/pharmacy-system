import type { Role, User } from '@pharmacy/shared-types';
interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    /** True while a saved token is being validated on launch — the router waits on this instead of flashing the login screen. */
    initializing: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    /** Called when a 401 arrives on an already-authenticated request — the token is stale, not the user's fault. */
    sessionExpired: () => void;
    /** Validates a saved token against the server so closing and reopening the app doesn't demand a password every time. Safe to call more than once (React.StrictMode double-invokes effects) — a second call while the first is still in flight reuses it instead of firing a duplicate request. */
    bootstrap: () => Promise<void>;
    can: (...roles: Role[]) => boolean;
}
export declare const useAuth: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
export {};
