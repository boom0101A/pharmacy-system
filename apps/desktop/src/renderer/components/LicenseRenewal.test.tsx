// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LicenseRenewal } from './LicenseRenewal';
import { LicenseExpiryBanner } from './LicenseExpiryBanner';

const DAY = 86_400_000;
const payload = (expiresAt: string | null) => ({ licenseId: 'x', licensedTo: 'صيدلية شفا', machineId: 'PC-1', issuedAt: '', expiresAt });

beforeEach(() => {
  (window as unknown as { pharmacy: unknown }).pharmacy = {
    getMachineId: vi.fn().mockResolvedValue('PC-1'),
    replaceLicense: vi.fn(),
  };
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('LicenseRenewal', () => {
  it('shows how long the trial has left, and the machine code to send for a new key', async () => {
    render(<LicenseRenewal license={{ valid: true, payload: payload(new Date(Date.now() + 5 * DAY).toISOString()) }} onChanged={() => {}} />);

    expect(screen.getByText(/صيدلية شفا/)).toBeTruthy();
    expect(screen.getByText(/بعد 5 يوم/)).toBeTruthy();
    expect(await screen.findByText('PC-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'نسخ رمز الجهاز' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('PC-1');
  });

  it('applies a new key and reports the new state', async () => {
    const renewed = { valid: true as const, payload: payload(null) };
    vi.mocked(window.pharmacy.replaceLicense).mockResolvedValue(renewed);
    const onChanged = vi.fn();
    render(<LicenseRenewal license={{ valid: true, payload: payload(new Date(Date.now() + DAY).toISOString()) }} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText('مفتاح جديد (تمديد أو ترخيص دائم)'), { target: { value: '  NEWKEY  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الترخيص' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(renewed));
    expect(window.pharmacy.replaceLicense).toHaveBeenCalledWith('NEWKEY');
    expect(screen.getByText('تم التحويل إلى ترخيص دائم')).toBeTruthy();
  });

  it('shows why a key was refused', async () => {
    vi.mocked(window.pharmacy.replaceLicense).mockResolvedValue({ valid: false, error: 'المفتاح الجديد أقصر من الترخيص الحالي — لم يُستبدل' });
    const onChanged = vi.fn();
    render(<LicenseRenewal license={{ valid: true, payload: payload(null) }} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText('مفتاح جديد (تمديد أو ترخيص دائم)'), { target: { value: 'K' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الترخيص' }));

    expect(await screen.findByText('المفتاح الجديد أقصر من الترخيص الحالي — لم يُستبدل')).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('LicenseExpiryBanner', () => {
  it.each([
    ['2 days left', 2 * DAY, true],
    ['10 days left', 10 * DAY, false],
  ])('%s → shown: %s', (_label, ms, shown) => {
    render(<LicenseExpiryBanner expiresAt={new Date(Date.now() + ms).toISOString()} />);
    expect(screen.queryByText(/تنتهي صلاحية الترخيص/) !== null).toBe(shown);
  });

  it('never shows for a perpetual license', () => {
    render(<LicenseExpiryBanner expiresAt={null} />);
    expect(screen.queryByText(/تنتهي صلاحية الترخيص/)).toBeNull();
  });
});
