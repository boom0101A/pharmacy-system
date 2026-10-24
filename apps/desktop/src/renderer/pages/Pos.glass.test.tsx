// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRODUCT = {
  id: 1, name: 'بنادول', barcode: null, categoryId: null, categoryName: null, unit: 'علبة',
  salePrice: 2000, purchasePrice: 1000, reorderLevel: 3, stock: 10, imageFilename: null, nearestExpiry: null,
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
const { useCart } = await import('../store/cart');
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

const dotOf = (name: string) =>
  screen.getByText(name).closest('button')!.querySelector('[class*="stockDot"]') as HTMLElement;

describe('POS — glass details', () => {
  beforeEach(() => {
    localStorage.clear();
    // The cart is an app-wide store; a line left by one test would leak into the next.
    useCart.getState().clear();
  });

  it('colours the stock dot by the same rule as the stock badge, hidden from screen readers', async () => {
    api.products.mockResolvedValueOnce([
      { ...PRODUCT, id: 1, name: 'متوفر', stock: 10 },
      { ...PRODUCT, id: 2, name: 'قليل', stock: 2 },
      { ...PRODUCT, id: 3, name: 'نافد', stock: 0 },
    ]);
    renderPos();
    await waitFor(() => expect(screen.getByText('متوفر')).toBeTruthy());

    expect(dotOf('متوفر').className).toMatch(/stockOk/);
    expect(dotOf('قليل').className).toMatch(/stockLow/);
    expect(dotOf('نافد').className).toMatch(/stockOut/);
    expect(dotOf('متوفر').getAttribute('aria-hidden')).toBe('true');
  });

  it('Esc closing a top-bar dialog does not also empty the cart', async () => {
    const { ShortcutsButton } = await import('../components/ShortcutsDialog');
    render(<ShortcutsButton />);
    renderPos();
    await waitFor(() => expect(screen.getByText('بنادول')).toBeTruthy());
    fireEvent.click(screen.getByText('بنادول').closest('button')!);
    await waitFor(() => expect(document.querySelector('[class*="cartCount"]')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'اختصارات لوحة المفاتيح' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(document.querySelector('[class*="cartCount"]')?.textContent).toBe('1');
  });

  it('counts the cart lines beside the title without renaming the heading', async () => {
    renderPos();
    await waitFor(() => expect(screen.getByText('بنادول')).toBeTruthy());
    expect(document.querySelector('[class*="cartCount"]')).toBeNull();

    fireEvent.click(screen.getByText('بنادول').closest('button')!);

    await waitFor(() => expect(document.querySelector('[class*="cartCount"]')?.textContent).toBe('1'));
    expect(screen.getByRole('heading', { name: 'السلة' })).toBeTruthy();
  });
});
