// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type AuthFn = (cb: (data: object) => void) => void;
const io = vi.fn((_url: string, _opts?: { auth: AuthFn }) => ({ on: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io }));

const { useStockSync } = await import('./useStockSync');
const { setServerUrl, setToken } = await import('./api');

describe('useStockSync', () => {
  it('reconnects to the new address when the server URL is changed in Settings', () => {
    localStorage.setItem('pharmacy.serverUrl', 'http://localhost:3000');
    renderHook(() => useStockSync(true));
    expect(io.mock.lastCall?.[0]).toBe('http://localhost:3000');

    act(() => setServerUrl('http://192.168.1.10:3000'));

    expect(io.mock.lastCall?.[0]).toBe('http://192.168.1.10:3000');
  });

  it('sends the current session token on every (re)connect — the server refuses anonymous listeners', () => {
    setToken('first');
    renderHook(() => useStockSync(true));
    const auth = io.mock.lastCall?.[1]?.auth as AuthFn;

    const seen: object[] = [];
    auth((d) => seen.push(d));
    setToken('renewed');
    auth((d) => seen.push(d));

    expect(seen).toEqual([{ token: 'first' }, { token: 'renewed' }]);
  });
});
