// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Simulates real fetch-abort semantics: the promise never settles on its own
 * (exactly like a cable-pulled-mid-request hang, as opposed to an immediate
 * connection refusal), but rejects with a real AbortError the moment the
 * request's AbortSignal fires — which is what request() must arrange to
 * happen after some bounded timeout instead of waiting forever.
 */
function hangingFetchThatRespectsAbort() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
}

describe('request() network timeout', () => {
  beforeEach(() => {
    localStorage.setItem('pharmacy.serverUrl', 'http://localhost:3000');
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a clear timeout message instead of hanging forever when the connection just hangs', async () => {
    global.fetch = hangingFetchThatRespectsAbort() as unknown as typeof fetch;
    const { api } = await import('./api');

    const assertion = expect(api.health()).rejects.toThrow('انتهت مهلة الاتصال بالخادم');
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
  });
});
