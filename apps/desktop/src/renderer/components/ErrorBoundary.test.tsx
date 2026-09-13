// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs the caught error to console.error by default — expected
    // noise for this test, not something we need to see in the run output.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>محتوى طبيعي</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('محتوى طبيعي')).toBeTruthy();
  });

  it('shows a clear Arabic fallback instead of a blank screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('حدث خطأ غير متوقع')).toBeTruthy();
    expect(screen.getByText('إعادة التحميل')).toBeTruthy();
  });
});
