// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const changePassword = vi.fn();
vi.mock('../lib/api', () => ({
  api: { changePassword: (...args: unknown[]) => changePassword(...args) },
  ApiError: class extends Error {},
  getToken: () => 'token',
  setToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { ChangePassword } = await import('./ChangePassword');
const { useAuth } = await import('../store/auth');

function fill(confirm = 'new-pass') {
  fireEvent.change(screen.getByLabelText('كلمة المرور الحالية'), { target: { value: 'admin123' } });
  fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'new-pass' } });
  fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور' }));
}

describe('ChangePassword', () => {
  beforeEach(() => {
    changePassword.mockReset();
    useAuth.setState({
      user: { id: 1, name: 'مدير', username: 'admin', role: 'admin', isActive: true, mustChangePassword: true, createdAt: '' },
    });
  });

  it('refuses mismatched passwords without calling the server', async () => {
    render(<ChangePassword />);
    fill('other');
    expect(await screen.findByText('كلمتا المرور غير متطابقتين')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('changes the password and lets the user into the app', async () => {
    changePassword.mockResolvedValue(undefined);
    render(<ChangePassword />);
    fill();
    await waitFor(() => expect(useAuth.getState().user?.mustChangePassword).toBe(false));
    expect(changePassword).toHaveBeenCalledWith('admin123', 'new-pass');
  });

  it('shows the server\'s reason and keeps the user here on failure', async () => {
    changePassword.mockRejectedValue(new Error('كلمة المرور الحالية غير صحيحة'));
    render(<ChangePassword />);
    fill();
    expect(await screen.findByText('كلمة المرور الحالية غير صحيحة')).toBeTruthy();
    expect(useAuth.getState().user?.mustChangePassword).toBe(true);
  });
});
