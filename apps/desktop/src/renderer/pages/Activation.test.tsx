// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Activation } from './Activation';

describe('Activation', () => {
  beforeEach(() => {
    (window as unknown as { pharmacy: unknown }).pharmacy = {
      getMachineId: vi.fn(),
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
});
