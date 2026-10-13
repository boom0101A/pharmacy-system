// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordDialog } from './ResetPasswordDialog';

function fill(confirm = 'new-pass') {
  fireEvent.change(screen.getByLabelText('اسم المستخدم'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('مفتاح الترخيص'), { target: { value: 'KEY' } });
  fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'new-pass' } });
  fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'إعادة التعيين' }));
}

describe('ResetPasswordDialog', () => {
  beforeEach(() => {
    localStorage.setItem('pharmacy.serverUrl', 'http://localhost:3000');
    (window as unknown as { pharmacy: unknown }).pharmacy = { resetPassword: vi.fn().mockResolvedValue(undefined) };
  });

  it('refuses to submit when the two new passwords differ', async () => {
    render(<ResetPasswordDialog open onClose={() => {}} onDone={() => {}} />);
    fill('different');
    expect(await screen.findByText('كلمتا المرور غير متطابقتين')).toBeTruthy();
    expect(window.pharmacy.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the reset with the current server address and reports success', async () => {
    const onDone = vi.fn();
    render(<ResetPasswordDialog open onClose={() => {}} onDone={onDone} />);
    fill();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('admin'));
    expect(window.pharmacy.resetPassword).toHaveBeenCalledWith({
      username: 'admin',
      licenseKey: 'KEY',
      newPassword: 'new-pass',
      serverUrl: 'http://localhost:3000',
    });
  });

  it('shows the Arabic reason when the reset fails, without the IPC prefix', async () => {
    vi.mocked(window.pharmacy.resetPassword).mockRejectedValue(
      new Error("Error invoking remote method 'auth:resetPassword': Error: مفتاح الترخيص غير صحيح لهذا الجهاز"),
    );
    render(<ResetPasswordDialog open onClose={() => {}} onDone={() => {}} />);
    fill();
    expect(await screen.findByText('مفتاح الترخيص غير صحيح لهذا الجهاز')).toBeTruthy();
  });
});
