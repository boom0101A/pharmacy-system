import { create } from 'zustand';
import type { Role, User } from '@pharmacy/shared-types';
import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from '../lib/api';
import { useCart } from './cart';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  /** True while a saved token is being validated on launch — the router waits on this instead of flashing the login screen. */
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** The server accepted a password the user chose — lift the first-login block. */
  passwordChanged: () => void;
  /** Called when a 401 arrives on an already-authenticated request — the token is stale, not the user's fault. */
  sessionExpired: () => void;
  /** Validates a saved token against the server so closing and reopening the app doesn't demand a password every time. Safe to call more than once (React.StrictMode double-invokes effects) — a second call while the first is still in flight reuses it instead of firing a duplicate request. */
  bootstrap: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}

let bootstrapPromise: Promise<void> | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initializing: getToken() !== null,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      set({ user, loading: false });
    } catch (err) {
      setToken(null);
      set({
        loading: false,
        error: err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول',
      });
    }
  },

  logout() {
    setToken(null);
    // The next cashier to sign in must never inherit this one's cart or discount.
    useCart.getState().clear();
    set({ user: null, error: null });
  },

  passwordChanged() {
    const user = get().user;
    if (user) set({ user: { ...user, mustChangePassword: false } });
  },

  sessionExpired() {
    setToken(null);
    useCart.getState().clear();
    set({ user: null, error: 'انتهت الجلسة — سجّل الدخول من جديد' });
  },

  bootstrap() {
    if (bootstrapPromise) return bootstrapPromise;

    if (!getToken()) {
      set({ initializing: false });
      return Promise.resolve();
    }

    bootstrapPromise = api
      .me()
      .then((user) => {
        set({ user, initializing: false });
      })
      .catch(() => {
        // An expired/invalid token, or the server unreachable at launch —
        // either way this is not a failed login attempt, so no error message.
        setToken(null);
        set({ user: null, initializing: false });
      });
    return bootstrapPromise;
  },

  can(...roles) {
    const user = get().user;
    return user !== null && roles.includes(user.role);
  },
}));

setUnauthorizedHandler(() => useAuth.getState().sessionExpired());
