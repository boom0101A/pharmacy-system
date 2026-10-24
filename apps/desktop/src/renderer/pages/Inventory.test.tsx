// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  products: vi.fn(),
  productStats: vi.fn(),
  deleteProduct: vi.fn(),
  restoreProduct: vi.fn(),
  categories: vi.fn().mockResolvedValue([]),
  productIngredients: vi.fn().mockResolvedValue([]),
  batches: vi.fn().mockResolvedValue([]),
};
vi.mock('../lib/api', () => ({ api, ApiError: class extends Error {} }));
vi.mock('../lib/api.js', () => ({ api, ApiError: class extends Error {} }));
const auth = vi.hoisted(() => ({ role: 'pharmacist' }));
vi.mock('../store/auth', () => ({
  useAuth: () => ({ can: (...roles: string[]) => roles.includes(auth.role) }),
}));

const { Inventory } = await import('./Inventory');
const { ToastProvider } = await import('../components/ui/Toast');

const PRODUCT = {
  id: 7, name: 'بنادول', barcode: null, categoryId: null, categoryName: null, unit: 'علبة',
  salePrice: 1000, purchasePrice: 500, reorderLevel: 0, stock: 3, imageFilename: null, nearestExpiry: null,
  unitsPerPackage: null, subUnitName: null, subUnitPrice: null, activeIngredient: null, dosageForm: null,
  strength: null, looseSubUnits: 0,
};

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Inventory />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('Inventory — deleting a product that was sold', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Object.values(api).forEach((fn) => fn.mockClear());
    api.products.mockResolvedValue([PRODUCT]);
    api.productStats.mockResolvedValue({ total: 1, low: 0, expiring: 0, out: 0 });
  });

  async function confirmDelete() {
    fireEvent.click(await screen.findByRole('button', { name: 'حذف بنادول' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/سيُؤرشف/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف' }));
  }

  it('hides the row at once but only deletes on the server after 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.deleteProduct.mockResolvedValue({ archived: true });
      renderPage();
      await confirmDelete();

      await waitFor(() => expect(screen.queryByRole('button', { name: 'حذف بنادول' })).toBeNull());
      expect(screen.getByText('حُذف «بنادول»')).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(4000));
      expect(api.deleteProduct).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(api.deleteProduct).toHaveBeenCalledWith(7);
      expect(await screen.findByText('تمت أرشفة الصنف')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('undo brings the row back and never touches the server', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPage();
      await confirmDelete();

      fireEvent.click(await screen.findByRole('button', { name: /تراجع/ }));
      expect(await screen.findByRole('button', { name: 'حذف بنادول' })).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(8000));
      expect(api.deleteProduct).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lists archived products with a restore button', async () => {
    api.restoreProduct.mockResolvedValue(PRODUCT);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /الأصناف المؤرشفة/ }));
    await waitFor(() => expect(api.products).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ status: 'archived' })));
    fireEvent.click(await screen.findByRole('button', { name: /استرجاع/ }));

    await waitFor(() => expect(api.restoreProduct).toHaveBeenCalledWith(7));
  });
});

describe('Inventory — page header and filter chips', () => {
  beforeEach(() => {
    auth.role = 'pharmacist';
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Object.values(api).forEach((fn) => fn.mockClear());
    api.products.mockResolvedValue([PRODUCT]);
    api.productStats.mockResolvedValue({ total: 12, low: 2, expiring: 3, out: 1 });
  });

  // The role is module-level; leave it as the other describe blocks expect.
  afterEach(() => {
    auth.role = 'pharmacist';
  });

  const chip = (name: RegExp) => screen.getByRole('button', { name });
  // The number is its own (LTR-isolated) span, so match the whole line.
  const countLine = (n: number) =>
    screen.findByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === `${n} صنف`);

  it('titles the page and counts the items in the current filter', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: 'المخزون' })).toBeTruthy();
    expect(await countLine(12)).toBeTruthy();
  });

  it('shows one chip per filter with its count, and filters on click', async () => {
    renderPage();
    await countLine(12);
    const group = screen.getByRole('group', { name: 'تصفية المخزون' });
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    expect(chip(/^الكل\s*12$/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/^منخفض\s*2$/)).toBeTruthy();
    expect(chip(/^قارب الانتهاء\s*3$/)).toBeTruthy();
    expect(chip(/^نفد\s*1$/)).toBeTruthy();

    fireEvent.click(chip(/^منخفض/));

    expect(chip(/^منخفض/).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/^الكل/).getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(api.products).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ status: 'low' })));
    expect(await countLine(2)).toBeTruthy();
  });

  it('has no "add to purchases" button on the low filter', async () => {
    renderPage();
    await countLine(12);
    fireEvent.click(chip(/^منخفض/));
    await countLine(2);
    expect(screen.queryByRole('button', { name: /إضافة للمشتريات/ })).toBeNull();
  });

  it('puts the F1 hint on the new-medicine button', async () => {
    renderPage();
    const add = await screen.findByRole('button', { name: /دواء جديد/ });
    expect(add.querySelector('kbd')?.textContent).toBe('F1');
  });

  it('gives the cashier the search and chips but no editing buttons', async () => {
    auth.role = 'cashier';
    renderPage();
    await countLine(12);
    expect(screen.getByRole('group', { name: 'تصفية المخزون' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /دواء جديد/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /الأصناف المؤرشفة/ })).toBeNull();
  });
});

describe('Inventory — a pending delete survives leaving the page', () => {
  it('keeps the row hidden when the page is opened again within the undo window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
      api.products.mockResolvedValue([PRODUCT]);
      api.productStats.mockResolvedValue({ total: 1, low: 0, expiring: 0, out: 0 });
      api.deleteProduct.mockResolvedValue({ archived: false });
      const first = render(
        <MemoryRouter>
          <ToastProvider>
            <Inventory />
          </ToastProvider>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'حذف بنادول' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'حذف' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'حذف بنادول' })).toBeNull());

      first.unmount();
      renderPage();
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(screen.queryByRole('button', { name: 'حذف بنادول' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
