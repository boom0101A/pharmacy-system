import { create } from 'zustand';
import { setConnectionResultHandler } from '../lib/api';
export const useConnection = create((set) => ({
    online: true,
    setOnline: (online) => set({ online }),
}));
setConnectionResultHandler((online) => useConnection.getState().setOnline(online));
