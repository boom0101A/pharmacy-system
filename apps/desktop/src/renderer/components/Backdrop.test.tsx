// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Backdrop } from './Backdrop';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Backdrop', () => {
  afterEach(() => setHidden(false));

  it('draws four decorative blobs that screen readers and clicks ignore', () => {
    const { container } = render(<Backdrop />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.children).toHaveLength(4);
  });

  it('pauses the drift while the window is hidden, and resumes after', () => {
    const { container } = render(<Backdrop />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.paused).toBeUndefined();

    act(() => setHidden(true));
    expect(root.dataset.paused).toBe('true');

    act(() => setHidden(false));
    expect(root.dataset.paused).toBeUndefined();
  });
});
