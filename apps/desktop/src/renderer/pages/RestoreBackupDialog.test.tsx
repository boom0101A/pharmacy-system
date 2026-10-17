// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const restoreBackup = vi.fn();
vi.mock('../lib/api', () => ({
  api: { restoreBackup: (...args: unknown[]) => restoreBackup(...args) },
  ApiError: class extends Error {},
  getToken: () => 'token',
  setToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { RestoreBackupDialog } = await import('./RestoreBackupDialog');

const NAME = 'backup-2026-10-12T07-36-54.660Z.json';

describe('RestoreBackupDialog', () => {
  beforeEach(() => {
    restoreBackup.mockReset();
  });

  it('stays disabled until RESTORE is typed exactly', () => {
    render(<RestoreBackupDialog name={NAME} onClose={() => {}} onRestored={() => {}} />);
    const button = screen.getByRole('button', { name: 'استعادة' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('للتأكيد اكتب RESTORE'), { target: { value: 'restore' } });
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('للتأكيد اكتب RESTORE'), { target: { value: 'RESTORE' } });
    expect(button.disabled).toBe(false);
  });

  it('restores that file and reports back', async () => {
    restoreBackup.mockResolvedValue(undefined);
    const onRestored = vi.fn();
    render(<RestoreBackupDialog name={NAME} onClose={() => {}} onRestored={onRestored} />);

    fireEvent.change(screen.getByLabelText('للتأكيد اكتب RESTORE'), { target: { value: 'RESTORE' } });
    fireEvent.click(screen.getByRole('button', { name: 'استعادة' }));

    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(restoreBackup).toHaveBeenCalledWith(NAME);
  });

  it('shows why a restore failed', async () => {
    restoreBackup.mockImplementation(async () => {
      throw new Error('ملف النسخة الاحتياطية تالف أو غير مكتمل');
    });
    render(<RestoreBackupDialog name={NAME} onClose={() => {}} onRestored={() => {}} />);

    fireEvent.change(screen.getByLabelText('للتأكيد اكتب RESTORE'), { target: { value: 'RESTORE' } });
    fireEvent.click(screen.getByRole('button', { name: 'استعادة' }));

    expect(await screen.findByText('ملف النسخة الاحتياطية تالف أو غير مكتمل')).toBeTruthy();
  });
});
