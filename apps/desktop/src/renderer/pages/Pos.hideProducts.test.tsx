// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRODUCT = {
  id: 1, name: 'بنادول', barcode: null, categoryId: null, categoryName: null, unit: 'علبة',
  salePrice: 2000, purchasePrice: 1000, reorderLevel: 0, stock: 10, imageFilename: null, nearestExpiry: null,
  unitsPerPackage: null, subUnitName: null, subUnitPrice: null, activeIngredient: null, dosageForm: null,
  strength: null, looseSubUnits: 0,
};
const api = {
  products: vi.fn().mockResolvedValue([PRODUCT]),
  productByBarcode: vi.fn(),
  productById: vi.fn(),
  createSale: vi.fn(),
};
vi.mock('../lib/api', () => ({
  api,
  ApiError: class extends Error {},
  getServerUrl: () => '',
  getToken: () => null,
  setToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  setConnectionResultHandler: vi.fn(),
}));

const { Pos } = await import('./Pos');
const { ToastProvider } = await import('../components/ui/Toast');

function renderPos() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Pos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const card = () => screen.queryByText('بنادول');

describe('POS — hiding the product grid', () => {
  beforeEach(() => {
    localStorage.clear();
    api.products.mockClear();
  });

  it('hides the cards, says how to sell, and keeps loading stock for the cart', async () => {
    renderPos();
    await waitFor(() => expect(card()).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /إخفاء الأدوية/ }));

    expect(card()).toBeNull();
    expect(screen.getByText(/الأدوية مخفية/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /إظهار الأدوية/ }).getAttribute('aria-pressed')).toBe('true');
    expect(api.products).toHaveBeenCalled();
  });

  it('still shows search results while hidden, and hides them again when the search is cleared', async () => {
    localStorage.setItem('pharmacy.pos.hideProducts', '1');
    renderPos();
    const search = screen.getByLabelText('بحث أو مسح باركود');

    fireEvent.change(search, { target: { value: 'بنا' } });
    await waitFor(() => expect(card()).toBeTruthy());

    fireEvent.change(search, { target: { value: '' } });
    await waitFor(() => expect(card()).toBeNull());
  });

  it('F8 toggles it from the keyboard', async () => {
    renderPos();
    await waitFor(() => expect(card()).toBeTruthy());

    act(() => {
      fireEvent.keyDown(window, { key: 'F8' });
    });
    expect(card()).toBeNull();

    act(() => {
      fireEvent.keyDown(window, { key: 'F8' });
    });
    expect(card()).toBeTruthy();
  });
});

describe('POS — layout and product cards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps the cart its usual width when the products are hidden', async () => {
    renderPos();
    await waitFor(() => expect(card()).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /إخفاء الأدوية/ }));

    expect(document.querySelector('[class*="layoutCompact"]')).toBeNull();
  });

  it('shows each medicine’s category on its card instead of the unit', async () => {
    api.products.mockResolvedValueOnce([
      { ...PRODUCT, id: 1, name: 'بنادول', categoryName: 'مسكنات' },
      { ...PRODUCT, id: 2, name: 'فيتامين', categoryName: null },
    ]);
    renderPos();
    await waitFor(() => expect(card()).toBeTruthy());

    expect(screen.getByText('مسكنات')).toBeTruthy();
    expect(screen.getByText('بدون تصنيف')).toBeTruthy();
    expect(screen.queryByText('علبة')).toBeNull();
  });
});
