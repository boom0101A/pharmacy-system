// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  api: {
    batches: vi.fn().mockResolvedValue([]),
    createBatch: vi.fn(),
    writeOffBatch: vi.fn().mockResolvedValue({}),
    deleteBatch: vi.fn(),
  },
}));
vi.mock('../store/auth.js', () => ({
  useAuth: (selector: (s: { can: () => boolean }) => unknown) => selector({ can: () => true }),
}));

const { ToastProvider } = await import('../components/ui/Toast');
const { ReceiveStockDialog } = await import('./ReceiveStockDialog');
const { api } = await import('../lib/api.js');

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

describe('ReceiveStockDialog write-off', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a write-off button only for a batch that has actually expired and still has stock', async () => {
    vi.mocked(api.batches).mockResolvedValue([
      { id: 10, productId: 1, batchNumber: null, expiryDate: isoDate(-5), quantity: 4, purchasePrice: 500, receivedAt: isoDate(-100), openedSubUnits: 0 },
      { id: 11, productId: 1, batchNumber: null, expiryDate: isoDate(30), quantity: 4, purchasePrice: 500, receivedAt: isoDate(-1), openedSubUnits: 0 },
      { id: 12, productId: 1, batchNumber: null, expiryDate: isoDate(-5), quantity: 0, purchasePrice: 500, receivedAt: isoDate(-200), openedSubUnits: 0 },
    ] as never);
    renderDialog();

    const writeOffButtons = await screen.findAllByRole('button', { name: 'إتلاف' });
    expect(writeOffButtons).toHaveLength(1);
  });

  it('calls api.writeOffBatch with the batch id after confirming', async () => {
    vi.mocked(api.batches).mockResolvedValue([
      { id: 10, productId: 1, batchNumber: null, expiryDate: isoDate(-5), quantity: 4, purchasePrice: 500, receivedAt: isoDate(-100), openedSubUnits: 0 },
    ] as never);
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'إتلاف' }));
    fireEvent.click(await screen.findByRole('button', { name: 'نعم، أتلف الكمية' }));

    await new Promise((r) => setTimeout(r, 0));
    expect(api.writeOffBatch).toHaveBeenCalledWith(10);
  });
});

describe('ReceiveStockDialog batch delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not send a second delete request while the first one is still in flight (a double-click race)', async () => {
    vi.mocked(api.batches).mockResolvedValue([
      { id: 20, productId: 1, batchNumber: null, expiryDate: null, quantity: 0, purchasePrice: 500, receivedAt: isoDate(-100), openedSubUnits: 0 },
    ] as never);
    let resolveDelete!: () => void;
    vi.mocked(api.deleteBatch).mockReturnValue(new Promise<void>((resolve) => (resolveDelete = resolve)));
    renderDialog();

    const deleteButton = await screen.findByRole('button', { name: 'حذف الدفعة' });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(api.deleteBatch).toHaveBeenCalledTimes(1);
    resolveDelete();
  });
});

describe('ReceiveStockDialog switching products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never shows the previous product\'s batches under the new product, even when its response arrives late', async () => {
    let resolveA!: (rows: unknown[]) => void;
    vi.mocked(api.batches)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveA = resolve as never)) as never)
      .mockResolvedValueOnce([] as never);

    const productA = { ...product, id: 1, name: 'دواء أ' } as typeof product;
    const productB = { ...product, id: 2, name: 'دواء ب' } as typeof product;
    const { rerender } = render(
      <ToastProvider>
        <ReceiveStockDialog product={productA} onClose={() => {}} onSaved={() => {}} />
      </ToastProvider>,
    );
    rerender(
      <ToastProvider>
        <ReceiveStockDialog product={productB} onClose={() => {}} onSaved={() => {}} />
      </ToastProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));

    resolveA([{ id: 99, productId: 1, batchNumber: 'A-BATCH', expiryDate: null, quantity: 3, purchasePrice: 1, receivedAt: isoDate(-1), openedSubUnits: 0 }]);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByDisplayValue('A-BATCH')).toBeNull();
  });
});

describe('ReceiveStockDialog purchase price', () => {
  it('shows the price with thousands separators and sends the plain number', async () => {
    vi.mocked(api.createBatch).mockResolvedValue({} as never);
    render(
      <ToastProvider>
        <ReceiveStockDialog
          product={{ ...(product as object), purchasePrice: 9000 } as typeof product}
          onClose={() => {}}
          onSaved={() => {}}
        />
      </ToastProvider>,
    );
    const price = screen.getByLabelText('سعر الشراء') as HTMLInputElement;
    expect(price.value).toBe('9,000');

    fireEvent.change(price, { target: { value: '12500' } });
    expect(price.value).toBe('12,500');
    fireEvent.change(screen.getByLabelText('الكمية'), { target: { value: '70' } });
    fireEvent.submit(document.getElementById('batch-form')!);

    await vi.waitFor(() => expect(api.createBatch).toHaveBeenCalled());
    expect(vi.mocked(api.createBatch).mock.calls.at(-1)![0]).toMatchObject({ purchasePrice: 12500, quantity: 70 });
  });
});