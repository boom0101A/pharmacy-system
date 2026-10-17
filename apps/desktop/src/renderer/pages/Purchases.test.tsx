// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  suppliers: vi.fn(),
  purchases: vi.fn(),
  products: vi.fn(),
  createPurchase: vi.fn(),
};
vi.mock('../lib/api', () => ({ api, ApiError: class extends Error {} }));

const { Purchases } = await import('./Purchases');
const { ToastProvider } = await import('../components/ui/Toast');

const PRODUCT = { id: 4, name: 'Rabedom', purchasePrice: 8000, salePrice: 9000, stock: 0, reorderLevel: 0 };

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Purchases />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function addProduct() {
  fireEvent.change(screen.getByLabelText('أضف صنفاً للفاتورة…'), { target: { value: 'Rab' } });
  fireEvent.click(await screen.findByRole('button', { name: /Rabedom/ }));
}

describe('Purchases screen', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.suppliers.mockResolvedValue([{ id: 1, name: 'مذخر سما اطباء' }]);
    api.purchases.mockResolvedValue([]);
    api.products.mockResolvedValue([PRODUCT]);
    api.createPurchase.mockResolvedValue({});
  });

  it('sends the invoice once a supplier is chosen and a product added', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'مذخر سما اطباء' });
    fireEvent.change(screen.getByLabelText('المورّد'), { target: { value: '1' } });
    await addProduct();

    fireEvent.click(screen.getByRole('button', { name: /حفظ الفاتورة/ }));

    await waitFor(() => expect(api.createPurchase).toHaveBeenCalled());
    expect(api.createPurchase.mock.calls[0][0]).toMatchObject({
      supplierId: 1,
      items: [{ productId: 4, quantity: 1, unitPrice: 8000 }],
    });
  });

  it('takes the same product twice as separate lines (two batches, two expiry dates)', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'مذخر سما اطباء' });
    fireEvent.change(screen.getByLabelText('المورّد'), { target: { value: '1' } });
    await addProduct();
    await addProduct();

    fireEvent.click(screen.getByRole('button', { name: /حفظ الفاتورة/ }));

    await waitFor(() => expect(api.createPurchase).toHaveBeenCalled());
    expect(api.createPurchase.mock.calls[0][0].items).toHaveLength(2);
  });

  it('sends a line ticked as bonus at price zero', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'مذخر سما اطباء' });
    fireEvent.change(screen.getByLabelText('المورّد'), { target: { value: '1' } });
    await addProduct();
    await addProduct();

    fireEvent.click(screen.getAllByLabelText(/بونص/)[1]);
    fireEvent.click(screen.getByRole('button', { name: /حفظ الفاتورة/ }));

    await waitFor(() => expect(api.createPurchase).toHaveBeenCalled());
    expect(api.createPurchase.mock.calls[0][0].items.map((i: { unitPrice: number }) => i.unitPrice)).toEqual([8000, 0]);
  });

  it('marks the supplier field itself when it was forgotten, and sends nothing', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'مذخر سما اطباء' });
    await addProduct();

    fireEvent.click(screen.getByRole('button', { name: /حفظ الفاتورة/ }));

    expect(screen.getByLabelText('المورّد').getAttribute('aria-invalid')).toBe('true');
    expect(api.createPurchase).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('المورّد'), { target: { value: '1' } });
    expect(screen.getByLabelText('المورّد').getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps a quantity typed just before clicking save', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'مذخر سما اطباء' });
    fireEvent.change(screen.getByLabelText('المورّد'), { target: { value: '1' } });
    await addProduct();

    const qty = screen.getByLabelText(/كمية/);
    fireEvent.focus(qty);
    fireEvent.change(qty, { target: { value: '12' } });
    fireEvent.blur(qty);
    fireEvent.click(screen.getByRole('button', { name: /حفظ الفاتورة/ }));

    await waitFor(() => expect(api.createPurchase).toHaveBeenCalled());
    expect(api.createPurchase.mock.calls[0][0].items[0].quantity).toBe(12);
  });
});
