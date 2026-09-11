import { useCallback, useEffect } from 'react';
import { api } from './api';
import { useConnection } from '../store/connection';
const PING_INTERVAL_MS = 7000;
/** Polls /health so a dead server shows up as a banner within seconds, not only on the next failed request. */
export function useConnectionPing() {
    const setOnline = useConnection((s) => s.setOnline);
    const recheck = useCallback(async () => {
        try {
            await api.health();
            setOnline(true);
        }
        catch {
            setOnline(false);
        }
    }, [setOnline]);
    useEffect(() => {
        recheck();
        const timer = window.setInterval(recheck, PING_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [recheck]);
    return recheck;
}
