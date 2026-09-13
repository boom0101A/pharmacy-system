import { create } from 'zustand';

interface PendingExpiryAlert {
  count: number;
}

interface ExpiryAlertState {
  /**
   * The expiring-soon count the last alert was raised for — null before the
   * first check this session. Comparing against this, not a boolean, is what
   * lets the count go 3 -> 5 and alert again without also re-alerting every
   * poll while it just sits at 3.
   */
  lastAlertedCount: number | null;
  setLastAlertedCount: (count: number) => void;
  /**
   * Decoupled from `lastAlertedCount` on purpose: the polling hook (no
   * ToastProvider ancestor, mounted at the top of App.tsx) decides *that* an
   * alert is due and records it here; a small component mounted *inside*
   * ToastProvider reacts to this and is the only thing that actually calls
   * useToast().warning(), then clears it back to null.
   */
  pendingAlert: PendingExpiryAlert | null;
  setPendingAlert: (alert: PendingExpiryAlert | null) => void;
  /**
   * Reads and clears pendingAlert in one atomic step. React (in development,
   * under StrictMode) can invoke the same effect body twice in a row for one
   * commit — both invocations close over the same `pendingAlert` prop value,
   * so a naive "read the prop, then call setPendingAlert(null)" lets both
   * invocations see it truthy and both raise a toast. Consuming through
   * live store state instead means the second invocation always finds it
   * already cleared by the first.
   */
  consumePendingAlert: () => PendingExpiryAlert | null;
}

export const useExpiryAlertState = create<ExpiryAlertState>((set, get) => ({
  lastAlertedCount: null,
  setLastAlertedCount: (count) => set({ lastAlertedCount: count }),
  pendingAlert: null,
  setPendingAlert: (alert) => set({ pendingAlert: alert }),
  consumePendingAlert: () => {
    const alert = get().pendingAlert;
    if (alert) set({ pendingAlert: null });
    return alert;
  },
}));
