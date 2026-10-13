// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  api: {
    createCaptureToken: vi.fn(),
    productById: vi.fn(),
  },
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,x') } }));

const { api } = await import('../lib/api.js');
const { PhoneCaptureNotice } = await import('./ProductDialog');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('PhoneCaptureNotice expiry', () => {
  // A short TTL (a few poll ticks, not the real ~10 minutes) keeps this fast
  // — vi.advanceTimersByTimeAsync still has to flush a real microtask queue
  // for every simulated tick, so a 600s/3s-interval version means ~200 of
  // them and reliably times out the test runner for no added coverage value.
  const SHORT_TTL_SECONDS = 5;

  it('stops polling and shows an expired message once the token TTL elapses, instead of polling forever silently', async () => {
    vi.useFakeTimers();
    (api.createCaptureToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'http://example/c/abc',
      expiresInSeconds: SHORT_TTL_SECONDS,
    });
    (api.productById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, imageFilename: null });

    render(<PhoneCaptureNotice productId={1} onClose={() => {}} onCaptured={() => {}} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Past the TTL — the next poll tick (every 3s) should detect expiry.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    expect(screen.getByText(/انتهت صلاحية/)).toBeTruthy();

    // No more polling after expiry: productById() call count should stop growing.
    const callsAtExpiry = (api.productById as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect((api.productById as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAtExpiry);
  }, 10000);

  it('lets the user mint a fresh token after expiry instead of being stuck', async () => {
    vi.useFakeTimers();
    (api.createCaptureToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'http://example/c/abc',
      expiresInSeconds: SHORT_TTL_SECONDS,
    });
    (api.productById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, imageFilename: null });

    render(<PhoneCaptureNotice productId={1} onClose={() => {}} onCaptured={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    screen.getByText(/انتهت صلاحية/);

    const mintCallsBefore = (api.createCaptureToken as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      screen.getByText('توليد رمز جديد').click();
    });
    expect((api.createCaptureToken as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(mintCallsBefore);
  }, 10000);
});
