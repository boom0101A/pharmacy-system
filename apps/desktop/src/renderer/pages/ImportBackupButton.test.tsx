// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const importBackup = vi.fn();
vi.mock('../lib/api', () => ({
  api: { importBackup: (...args: unknown[]) => importBackup(...args) },
  ApiError: class extends Error {},
}));

const { ImportBackupButton } = await import('./ImportBackupButton');
const { ToastProvider } = await import('../components/ui/Toast');

function pick(file: File) {
  fireEvent.change(screen.getByLabelText('ملف النسخة الاحتياطية'), { target: { files: [file] } });
}

describe('ImportBackupButton', () => {
  beforeEach(() => {
    importBackup.mockReset();
  });

  it('uploads the chosen file and hands back the name to restore', async () => {
    importBackup.mockResolvedValue({ name: 'backup-2026-10-17T12-00-00.000Z.json' });
    const onImported = vi.fn();
    render(
      <ToastProvider>
        <ImportBackupButton onImported={onImported} />
      </ToastProvider>,
    );
    const file = new File(['{}'], 'old-pc.json', { type: 'application/json' });

    pick(file);

    await waitFor(() => expect(onImported).toHaveBeenCalledWith('backup-2026-10-17T12-00-00.000Z.json'));
    expect(importBackup).toHaveBeenCalledWith(file);
  });

  it('shows the server\'s reason when the file is rejected', async () => {
    importBackup.mockRejectedValue(new Error('الملف ليس نسخة احتياطية صالحة من هذا النظام'));
    const onImported = vi.fn();
    render(
      <ToastProvider>
        <ImportBackupButton onImported={onImported} />
      </ToastProvider>,
    );

    pick(new File(['x'], 'bad.json'));

    expect(await screen.findByText('الملف ليس نسخة احتياطية صالحة من هذا النظام')).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });
});
