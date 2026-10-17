// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  api: { createUser: vi.fn(), updateUser: vi.fn() },
}));

const { ToastProvider } = await import('../components/ui/Toast');
const { UserDialog } = await import('./UserDialog');
type UserFixture = Parameters<typeof UserDialog>[0]['user'] & object;

const selfUser: UserFixture = {
  id: 1,
  name: 'أنا',
  username: 'me',
  role: 'admin',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date().toISOString(),
};
const otherUser: UserFixture = {
  id: 2,
  name: 'مستخدم آخر',
  username: 'other',
  role: 'cashier',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date().toISOString(),
};

function renderDialog(user: UserFixture, isSelf: boolean) {
  render(
    <ToastProvider>
      <UserDialog open user={user} isSelf={isSelf} onOpenChange={() => {}} onSaved={() => {}} />
    </ToastProvider>,
  );
}

describe('UserDialog self-edit guard', () => {
  it('disables the role select and active checkbox when editing your own account', () => {
    renderDialog(selfUser, true);
    expect((screen.getByLabelText('الدور') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText(/حساب نشط/) as HTMLInputElement).disabled).toBe(true);
  });

  it('leaves the role select and active checkbox enabled when editing someone else', () => {
    renderDialog(otherUser, false);
    expect((screen.getByLabelText('الدور') as HTMLSelectElement).disabled).toBe(false);
    expect((screen.getByLabelText(/حساب نشط/) as HTMLInputElement).disabled).toBe(false);
  });
});
