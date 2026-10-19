// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const playDelete = vi.fn();
vi.mock('../../lib/sounds.js', () => ({ playSuccess: vi.fn(), playError: vi.fn(), playDelete, playExpiryAlert: vi.fn() }));

const { ToastProvider, useToast } = await import('./Toast');

let toast: ReturnType<typeof useToast>;
function Capture() {
  toast = useToast();
  return null;
}

function show() {
  const onUndo = vi.fn();
  const onCommit = vi.fn();
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>,
  );
  act(() => toast.undoable({ title: 'حُذف «بنادول»', description: 'يمكنك التراجع خلال ثوانٍ', onUndo, onCommit }));
  return { onUndo, onCommit };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('undoable toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the title, a 5-second countdown and an undo button, with the delete sound', () => {
    show();
    expect(screen.getByText('حُذف «بنادول»')).toBeTruthy();
    expect(screen.getByRole('button', { name: /تراجع/ })).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(playDelete).toHaveBeenCalled();
  });

  it('commits exactly once after 5 seconds and goes away', () => {
    const { onUndo, onCommit } = show();
    advance(4900);
    expect(onCommit).not.toHaveBeenCalled();
    advance(200);
    expect(onCommit).toHaveBeenCalledTimes(1);
    advance(5000);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText('حُذف «بنادول»')).toBeNull();
  });

  it('undo cancels the commit for good', () => {
    const { onUndo, onCommit } = show();
    advance(2000);
    fireEvent.click(screen.getByRole('button', { name: /تراجع/ }));
    advance(10_000);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Ctrl+Z undoes while it is showing', () => {
    const { onUndo, onCommit } = show();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    advance(10_000);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('pauses the countdown while the pointer is over it', () => {
    const { onCommit } = show();
    advance(3000);
    fireEvent.mouseEnter(screen.getByRole('status'));
    advance(10_000);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByRole('status'));
    advance(2100);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
