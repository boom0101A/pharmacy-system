import { create } from 'zustand';

type Kind = 'product' | 'category';

interface PendingDeletesState {
  product: ReadonlySet<number>;
  category: ReadonlySet<number>;
  hide: (kind: Kind, id: number) => void;
  unhide: (kind: Kind, id: number) => void;
}

/**
 * Items whose undo window is still open. Kept outside the pages because the
 * undo toast outlives them: leaving Inventory and coming back within those
 * seconds must not bring a row back that is about to be deleted.
 */
export const usePendingDeletes = create<PendingDeletesState>((set) => ({
  product: new Set(),
  category: new Set(),
  hide: (kind, id) => set((s) => ({ [kind]: new Set(s[kind]).add(id) })),
  unhide: (kind, id) =>
    set((s) => {
      const next = new Set(s[kind]);
      next.delete(id);
      return { [kind]: next };
    }),
}));
