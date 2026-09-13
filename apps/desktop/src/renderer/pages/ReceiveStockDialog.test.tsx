// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  api: {
    batches: vi.fn().mockResolvedValue([]),
    createBatch: vi.fn(),
  },
}));
vi.mock('../store/auth.js', () => ({
  useAuth: (selector: (s: { can: () => boolean }) => unknown) => selector({ can: () => true }),
}));

const { ToastProvider } = await import('../components/ui/Toast');
const { ReceiveStockDialog } = await import('./ReceiveStockDialog');

const product = {
  id: 1,
  name: 'دواء اختبار',
  unit: 'علبة',
  purchasePrice: 1000,
} as unknown as Parameters<typeof ReceiveStockDialog>[0]['product'];

function renderDialog() {
  render(
    <ToastProvider>
      <ReceiveStockDialog product={product} onClose={() => {}} onSaved={() => {}} />
    </ToastProvider>,
  );
}

function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', class {} as unknown as typeof AudioContext);
});

describe('ReceiveStockDialog expiry warning', () => {
  it('warns when the entered expiry date is already in the past', async () => {
    renderDialog();
    const input = screen.getByLabelText('تاريخ الانتهاء');
    fireEvent.change(input, { target: { value: isoDate(-5) } });

    expect(await screen.findByText(/تاريخ في الماضي/)).toBeTruthy();
  });

  it('shows no warning for a future expiry date', async () => {
    renderDialog();
    const input = screen.getByLabelText('تاريخ الانتهاء');
    fireEvent.change(input, { target: { value: isoDate(30) } });

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/تاريخ في الماضي/)).toBeNull();
  });

  it('shows no warning while the field is empty', async () => {
    renderDialog();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/تاريخ في الماضي/)).toBeNull();
  });
});
