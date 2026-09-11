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
    return <Splash onFinish={finishSplash} />;
  }

  // Only reached on a slow network where /auth/me hasn't answered yet — most
  // launches never see this frame. Without it the login form would flash up
  // for an instant before snapping to the dashboard once the token checks out.
  if (initializing) {
    return (
      <div className={styles.bootLoading}>
        <span className={styles.spinner} aria-hidden="true" />
      </div>
    );
  }

  return (
    <ToastProvider>
      {/* Outside the router: a dead server is worth saying on the login screen
          too, where it is the actual reason the password "isn't working". */}
      <ConnectionBanner onRetry={recheckConnection} />
      {/* HashRouter: Electron loads the app from a file:// URL in production. */}
      <HashRouter>
        {!user ? (
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
        ) : (
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<Pos />} />
              <Route path="returns" element={<Returns />} />
              <Route path="inventory" element={<Inventory />} />
              {canManageStock && <Route path="suppliers" element={<Suppliers />} />}
              {canManageStock && <Route path="purchases" element={<Purchases />} />}
              {canManageStock && <Route path="reports" element={<Reports />} />}
              {user.role === 'admin' && <Route path="users" element={<Users />} />}
              {user.role === 'admin' && <Route path="settings" element={<Settings />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        )}
      </HashRouter>
    </ToastProvider>
  );
}
