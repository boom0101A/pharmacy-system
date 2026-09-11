import { create } from 'zustand';
import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from '../lib/api';
let bootstrapPromise = null;
export const useAuth = create((set, get) => ({
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
        }
        catch (err) {
            setToken(null);
            set({
                loading: false,
                error: err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول',
            });
        }
    },
    logout() {
        setToken(null);
        set({ user: null, error: null });
    },
    sessionExpired() {
        setToken(null);
        set({ user: null, error: 'انتهت الجلسة — سجّل الدخول من جديد' });
    },
    bootstrap() {
        if (bootstrapPromise)
            return bootstrapPromise;
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
