import { useEffect } from 'react';
import { useToast } from './ui/Toast.js';
import { useExpiryAlertState } from '../store/expiryAlert.js';

/**
 * Renders nothing — exists purely to sit inside <ToastProvider> where
 * useToast() is actually callable, unlike useExpiryAlert() itself which runs
 * from App.tsx's top level, above the provider.
 */
export function ExpiryAlertWatcher() {
  const toast = useToast();
  const pendingAlert = useExpiryAlertState((s) => s.pendingAlert);

  useEffect(() => {
    if (!pendingAlert) return;
    const alert = useExpiryAlertState.getState().consumePendingAlert();
    if (!alert) return;
    toast.warning(
      `${alert.count} صنف يقترب من تاريخ انتهاء الصلاحية`,
      'راجع تقرير انتهاء الصلاحية لمزيد من التفاصيل',
    );
  }, [pendingAlert, toast]);

  return null;
}
