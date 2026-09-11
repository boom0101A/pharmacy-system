import { create } from 'zustand';
import { setConnectionResultHandler } from '../lib/api';

interface ConnectionState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnection = create<ConnectionState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

setConnectionResultHandler((online) => useConnection.getState().setOnline(online));
