// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { Clock } from './Clock';
import { useAuth } from '../store/auth';
import { applyStoredAppearance } from '../lib/appearance';

const ADMIN = {
  id: 1, name: 'المدير', username: 'admin', role: 'admin' as const,
  isActive: true, mustChangePassword: false, createdAt: '2026-01-01T00:00:00.000Z',
};

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  );
}

describe('top bar', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    applyStoredAppearance();
    useAuth.setState({ user: ADMIN });
  });

  it('titles every page from the sidebar list, including the sales history', () => {
    renderShell('/history');
    expect(screen.getByRole('heading', { level: 1, name: 'سجل الفواتير' })).toBeTruthy();
  });

  it('switches dark mode from the moon button, for this machine', () => {
    renderShell('/');
    const toggle = screen.getByRole('button', { name: 'تبديل الوضع الليلي' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('pharmacy.appearance.dark')).toBe('1');
  });

  it('lists the app’s real shortcuts behind the keyboard button', () => {
    renderShell('/');
    fireEvent.click(screen.getByRole('button', { name: 'اختصارات لوحة المفاتيح' }));

    const dialog = screen.getByRole('dialog');
    for (const key of ['F12', 'F4', 'F8', 'F1', 'F2', 'Ctrl', 'Esc']) {
      expect(dialog.textContent).toContain(key);
    }
    // Nothing the app doesn't actually do.
    expect(dialog.textContent).not.toContain('Alt');
  });
});

describe('Clock', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the time and the Iraqi date in Latin digits, and moves on with the minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 21, 38, 30));
    render(<Clock />);

    expect(screen.getByText(/09:38/)).toBeTruthy();
    expect(screen.getByText(/الخميس/).textContent).toMatch(/22.*تشرين الأول/);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText(/09:39/)).toBeTruthy();
  });
});
