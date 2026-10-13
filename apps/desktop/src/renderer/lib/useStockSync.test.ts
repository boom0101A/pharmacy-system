// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const io = vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io }));

const { useStockSync } = await import('./useStockSync');
const { setServerUrl } = await import('./api');

describe('useStockSync', () => {
  it('reconnects to the new address when the server URL is changed in Settings', () => {
    localStorage.setItem('pharmacy.serverUrl', 'http://localhost:3000');
    renderHook(() => useStockSync(true));
    expect(io).toHaveBeenLastCalledWith('http://localhost:3000');

    act(() => setServerUrl('http://192.168.1.10:3000'));

    expect(io).toHaveBeenLastCalledWith('http://192.168.1.10:3000');
  });
});
