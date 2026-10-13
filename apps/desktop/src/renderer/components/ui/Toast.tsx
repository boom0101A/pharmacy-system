import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import styles from './Toast.module.css';
import { playDelete, playError, playExpiryAlert, playSuccess } from '../../lib/sounds.js';

interface ToastItem {
  id: number;
  tone: 'success' | 'error' | 'warning';
  title: string;
  description?: string;
}

interface ToastOptions {
  /** A removal, not a save/update — gets its own distinct sound instead of the generic success chime. */
  kind?: 'delete';
  /** Skip the automatic sound entirely — for a caller that plays its own signature sound instead (the completed-sale toast, for example). */
  silent?: boolean;
}

interface ToastContextValue {
  success: (title: string, description?: string, opts?: ToastOptions) => void;
  error: (title: string, description?: string) => void;
  /** Attention, not failure — an expiring-soon alert, for instance. Distinct from `error` in both color and sound. */
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (tone: ToastItem['tone'], title: string, description?: string, opts?: ToastOptions) => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, tone, title, description }]);

      if (opts?.silent) return;
      if (tone === 'error') playError();
      else if (tone === 'warning') playExpiryAlert();
      else if (opts?.kind === 'delete') playDelete();
      else playSuccess();
    },
    [],
  );

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Memoised: pages list `toast` in their data-loading effects. A fresh object
  // on every render made each error toast re-trigger the failed load, which
  // toasted again — an endless request/error-sound loop while offline.
  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, description, opts) => push('success', title, description, opts),
      error: (title, description) => push('error', title, description),
      warning: (title, description) => push('warning', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="up">
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            className={styles.toast}
            data-tone={item.tone}
            duration={4000}
            onOpenChange={(open) => !open && remove(item.id)}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 size={18} className={styles.icon} />
            ) : item.tone === 'warning' ? (
              <AlertTriangle size={18} className={styles.icon} />
            ) : (
              <XCircle size={18} className={styles.icon} />
            )}
            <div>
              <RadixToast.Title className={styles.title}>{item.title}</RadixToast.Title>
              {item.description && (
                <RadixToast.Description className={styles.description}>
                  {item.description}
                </RadixToast.Description>
              )}
            </div>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
