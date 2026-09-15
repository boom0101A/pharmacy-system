// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function hangingFetchThatRespectsAbort() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
}

/** What a real browser `fetch` throws for a refused/dropped connection — a raw TypeError, no status code. */
function refusingFetch() {
  return vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
}

describe('upload/download requests share request()\'s timeout and error translation', () => {
  beforeEach(() => {
    localStorage.setItem('pharmacy.serverUrl', 'http://localhost:3000');
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uploadProductImage times out instead of hanging forever on a connection that never answers', async () => {
    vi.useFakeTimers();
    global.fetch = hangingFetchThatRespectsAbort() as unknown as typeof fetch;
    const { api } = await import('./api');

    const assertion = expect(api.uploadProductImage(1, new Blob(['x']))).rejects.toThrow(
      'انتهت مهلة الاتصال بالخادم',
    );
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
  });

  it('uploadProductImage translates a raw connection failure into a clear Arabic message', async () => {
    global.fetch = refusingFetch() as unknown as typeof fetch;
    const { api } = await import('./api');

    await expect(api.uploadProductImage(1, new Blob(['x']))).rejects.toThrow('تعذّر الاتصال بالخادم');
  });

  it('uploadLogo translates a raw connection failure into a clear Arabic message', async () => {
    global.fetch = refusingFetch() as unknown as typeof fetch;
    const { api } = await import('./api');

    await expect(api.uploadLogo(new Blob(['x']))).rejects.toThrow('تعذّر الاتصال بالخادم');
  });

  it('deleteLogo translates a raw connection failure into a clear Arabic message', async () => {
    global.fetch = refusingFetch() as unknown as typeof fetch;
    const { api } = await import('./api');

    await expect(api.deleteLogo()).rejects.toThrow('تعذّر الاتصال بالخادم');
  });

  it('downloadBackup translates a raw connection failure into a clear Arabic message', async () => {
    global.fetch = refusingFetch() as unknown as typeof fetch;
    const { api } = await import('./api');

    await expect(api.downloadBackup('backup.sql')).rejects.toThrow('تعذّر الاتصال بالخادم');
  });
});
