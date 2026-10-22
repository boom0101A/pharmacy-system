// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const row = (id: number, total: number, returnedTotal = 0) => ({
  id, date: '2026-10-20T09:30:00.000Z', userName: 'علي', itemCount: 2, discount: 0, total, returnedTotal,
});
const api = {
  salesHistory: vi.fn(),
  saleById: vi.fn(),
};
vi.mock('../lib/api', () => ({ api, ApiError: class extends Error {} }));

const { SalesHistory } = await import('./SalesHistory');
const { ToastProvider } = await import('../components/ui/Toast');

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/history']}>
      <ToastProvider>
        <Routes>
          <Route path="/history" element={<SalesHistory />} />
          <Route path="/returns" element={<Where />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('SalesHistory', () => {
  beforeEach(() => {
    api.salesHistory.mockReset();
    api.saleById.mockReset();
    (window as unknown as { pharmacy: unknown }).pharmacy = { printReceipt: vi.fn().mockResolvedValue(undefined) };
  });

  it('shows the period totals and its invoices, newest first', async () => {
    api.salesHistory.mockResolvedValue({ rows: [row(12, 6000, 1000), row(11, 2500)], count: 2, sum: 8500 });
    renderPage();

    expect(await screen.findByText('8,500')).toBeTruthy();
    expect(screen.getByText(/فاتورة 12/)).toBeTruthy();
    expect(screen.getByText(/مُرجع منها 1,000/)).toBeTruthy();
  });

  it('a quick button asks for that period', async () => {
    api.salesHistory.mockResolvedValue({ rows: [], count: 0, sum: 0 });
    renderPage();
    await waitFor(() => expect(api.salesHistory).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'هذه السنة' }));

    await waitFor(() =>
      expect(api.salesHistory).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.stringMatching(/-01-01$/), offset: 0 })),
    );
  });

  it('"show more" fetches the next page and keeps the first', async () => {
    api.salesHistory
      .mockResolvedValueOnce({ rows: [row(3, 1)], count: 2, sum: 2 })
      .mockResolvedValueOnce({ rows: [row(2, 1)], count: 2, sum: 2 });
    renderPage();
    await screen.findByText(/فاتورة 3/);

    fireEvent.click(screen.getByRole('button', { name: /عرض المزيد/ }));

    expect(await screen.findByText(/فاتورة 2/)).toBeTruthy();
    expect(screen.getByText(/فاتورة 3/)).toBeTruthy();
    expect(api.salesHistory).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }));
  });

  it('opens an invoice with its lines, reprints it, and can go to return from it', async () => {
    api.salesHistory.mockResolvedValue({ rows: [row(12, 6000)], count: 1, sum: 6000 });
    api.saleById.mockResolvedValue({
      id: 12, userId: 1, userName: 'علي', date: '2026-10-20T09:30:00.000Z', total: 6000, discount: 0,
      items: [{ id: 1, saleId: 12, productId: 3, batchId: 1, quantity: 3, unitPrice: 2000, isSubUnit: false, productName: 'باراسيتامول', returnedQuantity: 1, unitLabel: 'علبة' }],
    });
    renderPage();

    fireEvent.click(await screen.findByText(/فاتورة 12/));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('باراسيتامول')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: /إعادة طباعة/ }));
    await waitFor(() => expect(window.pharmacy.printReceipt).toHaveBeenCalledWith(expect.objectContaining({ saleId: 12, total: 6000 })));

    fireEvent.click(within(dialog).getByRole('button', { name: /إرجاع من هذه الفاتورة/ }));
    expect((await screen.findByTestId('where')).textContent).toBe('/returns?sale=12');
  });
});
