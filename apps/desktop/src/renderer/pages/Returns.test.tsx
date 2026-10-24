// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const sale = {
  id: 1042,
  userId: 1,
  date: new Date().toISOString(),
  total: 6000,
  discount: 0,
  items: [
    { id: 9, saleId: 1042, productId: 3, batchId: 1, quantity: 3, unitPrice: 2000, isSubUnit: false, productName: 'باراسيتامول', returnedQuantity: 0, unitLabel: 'علبة' },
  ],
};
const api = {
  returns: vi.fn().mockResolvedValue([]),
  salesByDate: vi.fn().mockResolvedValue([]),
  saleById: vi.fn().mockResolvedValue(sale),
  createReturn: vi.fn(),
};
vi.mock('../lib/api', () => ({ api, ApiError: class extends Error {} }));
vi.mock('../store/auth', () => ({
  useAuth: (selector?: (s: { can: () => boolean; user: { role: string } }) => unknown) => {
    const state = { can: () => true, user: { role: 'admin' } };
    return selector ? selector(state) : state;
  },
}));

const { Returns } = await import('./Returns');
const { ToastProvider } = await import('../components/ui/Toast');

describe('Returns — numbers typed on an Arabic keyboard', () => {
  it('finds the invoice and takes the return quantity', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Returns />
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('رقم الفاتورة'), { target: { value: '١٠٤٢' } });
    fireEvent.click(screen.getByRole('button', { name: /بحث/ }));
    await waitFor(() => expect(api.saleById).toHaveBeenCalledWith(1042));

    const qty = (await screen.findByLabelText(/كمية إرجاع/)) as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '٢' } });

    expect(qty.value).toBe('2');
    expect(screen.getByText(/4,000/)).toBeTruthy();
  });
});

describe('Returns — going back to the list of invoices', () => {
  async function openFromList() {
    api.salesByDate.mockResolvedValue([{ ...sale, userName: 'علي' }]);
    render(
      <MemoryRouter>
        <ToastProvider>
          <Returns />
        </ToastProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /فاتورة رقم 1042/ }));
    await screen.findByLabelText(/كمية إرجاع/);
  }

  it('goes back to the day’s invoices with nothing typed', async () => {
    await openFromList();

    fireEvent.click(screen.getByRole('button', { name: /رجوع إلى قائمة الفواتير/ }));

    expect(screen.queryByLabelText(/كمية إرجاع/)).toBeNull();
    expect(await screen.findByRole('button', { name: /فاتورة رقم 1042/ })).toBeTruthy();
  });

  it('asks first when return quantities were typed, and Cancel keeps them', async () => {
    await openFromList();
    fireEvent.change(screen.getByLabelText(/كمية إرجاع/), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /رجوع إلى قائمة الفواتير/ }));
    expect(await screen.findByText('ترك هذه الفاتورة؟')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));

    expect((screen.getByLabelText(/كمية إرجاع/) as HTMLInputElement).value).toBe('1');
  });

  it('leaves the invoice once confirmed', async () => {
    await openFromList();
    fireEvent.change(screen.getByLabelText(/كمية إرجاع/), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /رجوع إلى قائمة الفواتير/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'ترك الفاتورة' }));

    await waitFor(() => expect(screen.queryByLabelText(/كمية إرجاع/)).toBeNull());
  });

  it('Esc goes back too', async () => {
    await openFromList();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByLabelText(/كمية إرجاع/)).toBeNull());
  });
});

describe('Returns — opened from the sales history', () => {
  it('opens the invoice named in the link straight away', async () => {
    api.saleById.mockClear();
    render(
      <MemoryRouter initialEntries={['/returns?sale=1042']}>
        <ToastProvider>
          <Returns />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.saleById).toHaveBeenCalledWith(1042));
    expect(await screen.findByLabelText(/كمية إرجاع/)).toBeTruthy();
  });
});

describe('Returns — browsing sales by day', () => {
  it('never shows an earlier day’s sales under the newly chosen day when its answer arrives late', async () => {
    const row = (id: number, userName: string) => ({ id, date: new Date().toISOString(), total: 1000, discount: 0, userName, items: [] });
    let resolveFirst!: (rows: unknown[]) => void;
    api.salesByDate
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)) as never)
      .mockResolvedValueOnce([row(2, 'كاشير اليوم الجديد')] as never);
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <Returns />
        </ToastProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(resolveFirst).toBeTypeOf('function'));

    const date = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(date, { target: { value: '2026-01-02' } });
    expect(await screen.findByText('كاشير اليوم الجديد')).toBeTruthy();

    resolveFirst([row(1, 'كاشير اليوم القديم')]);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('كاشير اليوم القديم')).toBeNull();
  });
});
