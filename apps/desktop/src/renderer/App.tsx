import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import styles from './App.module.css';
import { Activation } from './pages/Activation';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExpiryAlertWatcher } from './components/ExpiryAlertWatcher';
import { Splash } from './components/Splash';
import { Button } from './components/ui/Button';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
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
import { getServerUrl, setServerUrl } from './lib/api';
import { correctedLocalServerUrl } from './lib/serverMode';
import { useStockSync } from './lib/useStockSync';
import { useConnectionPing } from './lib/useConnectionPing';
import { useExpiryAlert } from './lib/useExpiryAlert';
import { useLicenseCheck } from './lib/useLicenseCheck';
import { ConnectionBanner } from './components/ConnectionBanner';
import { BackendNotice } from './components/BackendNotice';
import { useBackendStatus } from './lib/useBackendStatus';

export function App() {
  const user = useAuth((s) => s.user);
  const initializing = useAuth((s) => s.initializing);
  const canManageStock = user?.role === 'admin' || user?.role === 'pharmacist';
  useStockSync(user !== null);
  const recheckConnection = useConnectionPing();
  const backendStatus = useBackendStatus();

  // On the machine running the bundled server, follow its real address — a
  // hand-typed local address must never leave the app pointed at nothing.
  useEffect(() => {
    const corrected = correctedLocalServerUrl(getServerUrl(), backendStatus);
    if (!corrected) return;
    setServerUrl(corrected);
    recheckConnection();
    void useAuth.getState().bootstrap();
    void useBranding.getState().refresh();
  }, [backendStatus, recheckConnection]);
  useExpiryAlert(user !== null);
  const [showSplash, setShowSplash] = useState(true);
  // Purely local (no network), so this resolves in a few milliseconds — well
  // before the splash's own dwell time ends.
  const { licensed: checkedLicensed, error: licenseError } = useLicenseCheck();
  // Activation resolves the same run without waiting for a re-check.
  const [activated, setActivated] = useState(false);
  const licensed = activated || checkedLicensed;
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

  // A genuine failure to even check (e.g. the machine-id registry read
  // throwing) used to leave `licensed` stuck at null forever — an endless
  // spinner with no error shown. This is distinct from a normal "not
  // licensed yet" result, which resolves licensed=false with no error and
  // falls through to the Activation screen below as always.
  if (licenseError) {
    return (
      <div className={styles.bootLoading}>
        <div className={styles.bootErrorBox}>
          <p className={styles.bootErrorMessage}>{licenseError}</p>
          <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  if (licensed === null) {
    return (
      <div className={styles.bootLoading}>
        <span className={styles.spinner} aria-hidden="true" />
      </div>
    );
  }

  // Blocks everything else — a stale/mismatched/expired license means the
  // rest of the app (including the server login itself) never renders.
  if (!licensed) {
    return <Activation onActivated={() => setActivated(true)} />;
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
    <ErrorBoundary>
      <ToastProvider>
        <ExpiryAlertWatcher />
        {/* Above the connection banner on purpose: while the bundled database
            is still being created, "لا يوجد اتصال" is true but misleading —
            this says what is actually happening. */}
        <BackendNotice status={backendStatus} />
        {/* Outside the router: a dead server is worth saying on the login screen
            too, where it is the actual reason the password "isn't working". */}
        <ConnectionBanner onRetry={recheckConnection} />
        {/* HashRouter: Electron loads the app from a file:// URL in production. */}
        <HashRouter>
          {!user ? (
            <Routes>
              <Route path="*" element={<Login />} />
            </Routes>
          ) : user.mustChangePassword ? (
            <Routes>
              <Route path="*" element={<ChangePassword />} />
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
    </ErrorBoundary>
  );
}
