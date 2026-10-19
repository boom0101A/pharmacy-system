import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Trash2, Undo2, XCircle } from 'lucide-react';
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

interface UndoableOptions {
  title: string;
  description?: string;
  /** How long the action can still be taken back. */
  durationMs?: number;
  onUndo: () => void;
  /** Runs once the time is up — the deferred action itself. */
  onCommit: () => void;
}

interface UndoItem extends UndoableOptions {
  id: number;
}

interface ToastContextValue {
  success: (title: string, description?: string, opts?: ToastOptions) => void;
  error: (title: string, description?: string) => void;
  /** Attention, not failure — an expiring-soon alert, for instance. Distinct from `error` in both color and sound. */
  warning: (title: string, description?: string) => void;
  /**
   * For an action that cannot be reversed once sent (a delete): the caller
   * holds it back, and exactly one of onUndo / onCommit runs.
   */
  undoable: (opts: UndoableOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [undoItems, setUndoItems] = useState<UndoItem[]>([]);
  const dropUndo = useCallback((id: number) => setUndoItems((prev) => prev.filter((t) => t.id !== id)), []);

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
      undoable: (opts) => {
        setUndoItems((prev) => [...prev, { ...opts, id: nextId++ }]);
        playDelete();
      },
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
      {undoItems.length > 0 && (
        <div className={styles.undoStack}>
          {undoItems.map((item, index) => (
            <UndoToast
              key={item.id}
              item={item}
              newest={index === undoItems.length - 1}
              onDone={() => dropUndo(item.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TICK_MS = 100;
const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Its own timer rather than Radix's: the countdown has to be drawn, paused
 * while the pointer rests on it, and must settle exactly once — undo or commit.
 */
function UndoToast({ item, newest, onDone }: { item: UndoItem; newest: boolean; onDone: () => void }) {
  const total = item.durationMs ?? 5000;
  const [remaining, setRemaining] = useState(total);
  const [paused, setPaused] = useState(false);
  const settled = useRef(false);

  const settle = useCallback(
    (how: 'undo' | 'commit') => {
      if (settled.current) return;
      settled.current = true;
      if (how === 'undo') item.onUndo();
      else item.onCommit();
      onDone();
    },
    [item, onDone],
  );

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setRemaining((r) => r - TICK_MS), TICK_MS);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (remaining <= 0) settle('commit');
  }, [remaining, settle]);

  // Ctrl+Z takes back the most recent action only.
  useEffect(() => {
    if (!newest) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        settle('undo');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newest, settle]);

  const fraction = Math.max(0, remaining) / total;

  return (
    <div
      role="status"
      className={styles.undoToast}
      data-paused={paused || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className={styles.ring} aria-hidden="true">
        <svg viewBox="0 0 40 40" width="40" height="40">
          <circle cx="20" cy="20" r={RING_RADIUS} className={styles.ringTrack} />
          <circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            className={styles.ringValue}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - fraction)}
          />
        </svg>
        <span className={styles.ringCount}>{Math.max(1, Math.ceil(remaining / 1000))}</span>
      </span>
      <div className={styles.undoText}>
        <div className={styles.undoTitle}>
          <Trash2 size={14} />
          {item.title}
        </div>
        {item.description && <div className={styles.undoDescription}>{item.description}</div>}
      </div>
      <button type="button" className={styles.undoButton} onClick={() => settle('undo')} title="Ctrl+Z">
        <Undo2 size={16} />
        تراجع
      </button>
      <span className={styles.undoProgress} style={{ transform: `scaleX(${fraction})` }} aria-hidden="true" />
    </div>
  );
}
