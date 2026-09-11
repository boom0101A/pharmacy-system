import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import styles from './App.module.css';
import { AppShell } from './components/AppShell';
import { Splash } from './components/Splash';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Pos } from './pages/Pos';
import { Inventory } from './pages/Inventory';
import { Suppliers } from './pages/Suppliers';
import { Purchases } from './pages/Purchases';
import { Returns } from './pages/Returns';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { useAuth } from './store/auth';
import { useBranding } from './store/branding';
import { useStockSync } from './lib/useStockSync';
import { useConnectionPing } from './lib/useConnectionPing';
import { ConnectionBanner } from './components/ConnectionBanner';
export function App() {
    const user = useAuth((s) => s.user);
    const initializing = useAuth((s) => s.initializing);
    const canManageStock = user?.role === 'admin' || user?.role === 'pharmacist';
    useStockSync(user !== null);
    const recheckConnection = useConnectionPing();
    const [showSplash, setShowSplash] = useState(true);
    // Stable so a connection ping re-rendering mid-fade can't restart its timer.
    const finishSplash = useCallback(() => setShowSplash(false), []);
    // Starts alongside the splash screen, not after it — a saved token is
    // validated over the LAN in well under the splash's own dwell time, so by
    // the time the splash finishes this has almost always already resolved.
    useEffect(() => {
        useAuth.getState().bootstrap();
        // Unauthenticated, like the auth check above — the login screen needs the
        // logo before anyone has signed in.
        useBranding.getState().refresh();
    }, []);
    if (showSplash) {
        return _jsx(Splash, { onFinish: finishSplash });
    }
    // Only reached on a slow network where /auth/me hasn't answered yet — most
    // launches never see this frame. Without it the login form would flash up
    // for an instant before snapping to the dashboard once the token checks out.
    if (initializing) {
        return (_jsx("div", { className: styles.bootLoading, children: _jsx("span", { className: styles.spinner, "aria-hidden": "true" }) }));
    }
    return (_jsxs(ToastProvider, { children: [_jsx(ConnectionBanner, { onRetry: recheckConnection }), _jsx(HashRouter, { children: !user ? (_jsx(Routes, { children: _jsx(Route, { path: "*", element: _jsx(Login, {}) }) })) : (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "pos", element: _jsx(Pos, {}) }), _jsx(Route, { path: "returns", element: _jsx(Returns, {}) }), _jsx(Route, { path: "inventory", element: _jsx(Inventory, {}) }), canManageStock && _jsx(Route, { path: "suppliers", element: _jsx(Suppliers, {}) }), canManageStock && _jsx(Route, { path: "purchases", element: _jsx(Purchases, {}) }), canManageStock && _jsx(Route, { path: "reports", element: _jsx(Reports, {}) }), user.role === 'admin' && _jsx(Route, { path: "users", element: _jsx(Users, {}) }), user.role === 'admin' && _jsx(Route, { path: "settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) })) })] }));
}
