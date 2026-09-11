import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, XCircle } from 'lucide-react';
import styles from './Toast.module.css';

interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  title: string;
  description?: string;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastItem['tone'], title: string, description?: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, tone, title, description }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (title, description) => push('success', title, description),
    error: (title, description) => push('error', title, description),
  };

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
