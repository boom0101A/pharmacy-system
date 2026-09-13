// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const playSuccess = vi.fn();
const playError = vi.fn();
const playDelete = vi.fn();
const playExpiryAlert = vi.fn();
vi.mock('../../lib/sounds.js', () => ({ playSuccess, playError, playDelete, playExpiryAlert }));

const { ToastProvider, useToast } = await import('./Toast');

let latestToast: ReturnType<typeof useToast>;
function Capture() {
  latestToast = useToast();
  return null;
}

function renderProvider() {
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>,
  );
}

beforeEach(() => {
  playSuccess.mockClear();
  playError.mockClear();
  playDelete.mockClear();
  playExpiryAlert.mockClear();
});

describe('toast sounds', () => {
  it('plays the generic success sound for an ordinary success toast', () => {
    renderProvider();
    act(() => latestToast.success('تم الحفظ'));
    expect(playSuccess).toHaveBeenCalledTimes(1);
    expect(playDelete).not.toHaveBeenCalled();
  });

  it('plays the error sound for an error toast', () => {
    renderProvider();
    act(() => latestToast.error('فشل'));
    expect(playError).toHaveBeenCalledTimes(1);
    expect(playSuccess).not.toHaveBeenCalled();
  });

  it('plays the distinct delete sound instead of the generic success sound when tagged as a delete', () => {
    renderProvider();
    act(() => latestToast.success('تم الحذف', undefined, { kind: 'delete' }));
    expect(playDelete).toHaveBeenCalledTimes(1);
    expect(playSuccess).not.toHaveBeenCalled();
  });

  it('plays nothing when the toast is marked silent, so a caller can supply its own signature sound instead', () => {
    renderProvider();
    act(() => latestToast.success('تمت الفاتورة', undefined, { silent: true }));
    expect(playSuccess).not.toHaveBeenCalled();
    expect(playDelete).not.toHaveBeenCalled();
    expect(playError).not.toHaveBeenCalled();
  });

  it('plays the distinct expiry-alert sound for a warning toast, not the generic success/error sounds', () => {
    renderProvider();
    act(() => latestToast.warning('أصناف تنتهي صلاحيتها قريباً'));
    expect(playExpiryAlert).toHaveBeenCalledTimes(1);
    expect(playSuccess).not.toHaveBeenCalled();
    expect(playError).not.toHaveBeenCalled();
  });
});
