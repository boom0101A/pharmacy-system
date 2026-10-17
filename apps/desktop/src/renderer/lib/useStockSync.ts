import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getServerUrl, getToken, SERVER_URL_CHANGED_EVENT } from './api';
import { useStockVersion } from '../store/stockSync';

let socket: Socket | null = null;

/** Connects to the server's stock-change broadcast only while `enabled` (i.e. once logged in) — no point listening before there's anything to react to. */
export function useStockSync(enabled: boolean) {
  const bump = useStockVersion((s) => s.bump);
  // Followed live: changing the address in Settings used to leave the socket
  // on the old server, so other tills' sales stopped refreshing this one.
  const [serverUrl, setServerUrlState] = useState(getServerUrl);

  useEffect(() => {
    const onChange = () => setServerUrlState(getServerUrl());
    window.addEventListener(SERVER_URL_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SERVER_URL_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // A function, not a value: each reconnect reads the token current then.
    socket = io(serverUrl, { auth: (cb) => cb({ token: getToken() }) });
    socket.on('stock:changed', () => bump());

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [enabled, bump, serverUrl]);
}
