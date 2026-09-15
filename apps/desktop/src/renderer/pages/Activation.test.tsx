// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Activation } from './Activation';

describe('Activation', () => {
  beforeEach(() => {
    (window as unknown as { pharmacy: unknown }).pharmacy = {
      getMachineId: vi.fn().mockResolvedValue('MACHINE-1'),
      activateLicense: vi.fn(),
    };
  });

  it('shows a clear error instead of an endless "..." when reading the machine id fails', async () => {
    (window.pharmacy.getMachineId as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('تعذّر قراءة معرّف الجهاز من سجل ويندوز'),
    );

    render(<Activation onActivated={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('تعذّر قراءة معرّف الجهاز من سجل ويندوز')).toBeTruthy();
    });
  });

  it('shows a clear error instead of failing silently when activation itself rejects (an IPC failure, not just an invalid key)', async () => {
    (window.pharmacy.activateLicense as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('تعذّر الاتصال بنظام الترخيص'),
    );

    render(<Activation onActivated={() => {}} />);
    await waitFor(() => expect(screen.getByText('MACHINE-1')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('مفتاح الترخيص'), { target: { value: 'SOME-KEY' } });
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل' }));

    await waitFor(() => {
      expect(screen.getByText('تعذّر الاتصال بنظام الترخيص')).toBeTruthy();
    });
  });
});
