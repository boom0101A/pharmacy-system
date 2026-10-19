// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../store/auth', () => ({
  useAuth: () => ({ can: (...roles: string[]) => roles.includes('pharmacist') }),
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

  it('lets the pharmacist delete, and says it was archived when it had invoices', async () => {
    api.deleteProduct.mockResolvedValue({ archived: true });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'حذف بنادول' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/سيُؤرشف/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف' }));

    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith(7));
    expect(await screen.findByText('تمت أرشفة الصنف')).toBeTruthy();
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
