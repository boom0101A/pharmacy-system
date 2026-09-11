import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getServerUrl } from './api';
import { useStockVersion } from '../store/stockSync';

let socket: Socket | null = null;

/** Connects to the server's stock-change broadcast only while `enabled` (i.e. once logged in) — no point listening before there's anything to react to. */
export function useStockSync(enabled: boolean) {
  const bump = useStockVersion((s) => s.bump);

  useEffect(() => {
    if (!enabled) return;

    socket = io(getServerUrl());
    socket.on('stock:changed', () => bump());

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [enabled, bump]);
}
