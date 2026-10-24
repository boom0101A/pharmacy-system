// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', () => ({
  api: {
    batches: vi.fn(),
    createBatch: vi.fn(),
    writeOffBatch: vi.fn(),
    deleteBatch: vi.fn(),
    adjustBatch: vi.fn(),
    stockAdjustments: vi.fn(),
  },
}));
const auth = vi.hoisted(() => ({ role: 'pharmacist' }));
vi.mock('../store/auth.js', () => ({
  useAuth: (selector: (s: { can: (...roles: string[]) => boolean }) => unknown) =>
    selector({ can: (...roles: string[]) => roles.includes(auth.role) }),
}));

const { ToastProvider } = await import('../components/ui/Toast');
const { ReceiveStockDialog } = await import('./ReceiveStockDialog');
const { api } = await import('../lib/api.js');

const product = { id: 1, name: 'بنادول', unit: 'علبة', purchasePrice: 1000 } as unknown as Parameters<
  typeof ReceiveStockDialog
>[0]['product'];

const BATCH = {
  id: 10, productId: 1, batchNumber: null, expiryDate: null, quantity: 500, purchasePrice: 500,
  receivedAt: '2026-10-20T08:00:00.000Z', openedSubUnits: 0, purchaseId: 77,
};

function renderDialog() {
  render(
    <ToastProvider>
      <ReceiveStockDialog product={product} onClose={() => {}} onSaved={() => {}} />
    </ToastProvider>,
  );
}

async function openAdjust() {
  renderDialog();
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل الكمية' }));
  return screen.findByRole('dialog', { name: /تعديل كمية الدفعة/ });
}

describe('ReceiveStockDialog — correcting a batch quantity', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', class {} as unknown as typeof AudioContext);
    vi.clearAllMocks();
    auth.role = 'pharmacist';
    vi.mocked(api.batches).mockResolvedValue([BATCH] as never);
    vi.mocked(api.stockAdjustments).mockResolvedValue([] as never);
  });
  afterEach(() => {
    auth.role = 'pharmacist';
  });

  it('offers the correction to the pharmacist', async () => {
    renderDialog();
    expect(await screen.findByRole('button', { name: 'تعديل الكمية' })).toBeTruthy();
  });

  it('does not offer it to the cashier', async () => {
    auth.role = 'cashier';
    renderDialog();
    // The batch row itself has rendered…
    await screen.findByText('500');
    // …without the correction button.
    expect(screen.queryByRole('button', { name: 'تعديل الكمية' })).toBeNull();
  });

  it('warns that the purchase invoice will be corrected too', async () => {
    const dialog = await openAdjust();
    // The invoice number is its own (LTR-isolated) span, so read the whole line.
    expect(dialog.textContent?.replace(/\s+/g, ' ')).toMatch(/فاتورة الشراء رقم 77/);
  });

  it('refuses to save without a reason or with an unchanged quantity, saying both at once', async () => {
    const dialog = await openAdjust();
    fireEvent.change(within(dialog).getByLabelText('الكمية الصحيحة'), { target: { value: '500' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديل' }));

    expect(await within(dialog).findByText(/مطابقة للحالية/)).toBeTruthy();
    expect(within(dialog).getByText(/اكتب سبب التعديل/)).toBeTruthy();
    expect(api.adjustBatch).not.toHaveBeenCalled();
  });

  it('sends the corrected quantity with the quantity it showed and the reason', async () => {
    vi.mocked(api.adjustBatch).mockResolvedValue({ ...BATCH, quantity: 50 } as never);
    const dialog = await openAdjust();

    fireEvent.change(within(dialog).getByLabelText('الكمية الصحيحة'), { target: { value: '٥٠' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'خطأ إدخال' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديل' }));

    await waitFor(() =>
      expect(api.adjustBatch).toHaveBeenCalledWith(10, { quantity: 50, expectedQuantity: 500, reason: 'خطأ إدخال' }),
    );
  });

  it('shows the server’s refusal when a sale changed the quantity meanwhile', async () => {
    vi.mocked(api.adjustBatch).mockRejectedValue(new Error('تغيّرت كمية هذه الدفعة للتو'));
    const dialog = await openAdjust();

    fireEvent.change(within(dialog).getByLabelText('الكمية الصحيحة'), { target: { value: '50' } });
    fireEvent.change(within(dialog).getByLabelText('السبب'), { target: { value: 'جرد' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديل' }));

    expect(await screen.findByText(/تغيّرت كمية هذه الدفعة للتو/)).toBeTruthy();
  });

  it('lists the past corrections under the batches', async () => {
    vi.mocked(api.stockAdjustments).mockResolvedValue([
      { id: 1, batchId: 10, oldQuantity: 48, newQuantity: 5, reason: 'خطأ إدخال', userName: 'الصيدلي أحمد', purchaseItemId: null, createdAt: '2026-10-24T07:30:00.000Z' },
    ] as never);
    renderDialog();

    const log = await screen.findByRole('list', { name: 'سجل تعديلات الكمية' });
    expect(log.textContent).toMatch(/48/);
    expect(log.textContent).toMatch(/5/);
    expect(log.textContent).toMatch(/خطأ إدخال/);
    expect(log.textContent).toMatch(/الصيدلي أحمد/);
  });
});
