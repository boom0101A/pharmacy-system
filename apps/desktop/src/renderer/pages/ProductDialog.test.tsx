// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@pharmacy/shared-types';

vi.mock('../lib/api.js', () => ({
  api: {
    categories: vi.fn().mockResolvedValue([]),
    productIngredients: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  },
}));

const { ToastProvider } = await import('../components/ui/Toast');
const { ProductDialog } = await import('./ProductDialog');

const BASE_PRODUCT: Product = {
  id: 5,
  name: 'بانادول',
  barcode: null,
  categoryId: null,
  categoryName: null,
  unit: 'علبة',
  salePrice: 1000,
  purchasePrice: 800,
  reorderLevel: 10,
  stock: 20,
  imageFilename: null,
  nearestExpiry: null,
  unitsPerPackage: null,
  subUnitName: null,
  subUnitPrice: null,
  activeIngredient: null,
  dosageForm: null,
  strength: null,
  looseSubUnits: 0,
};

function renderDialog(product: Product | null) {
  render(
    <ToastProvider>
      <ProductDialog open product={product} onOpenChange={() => {}} onSaved={() => {}} />
    </ToastProvider>,
  );
}

describe('ProductDialog barcode actions', () => {
  it('shows neither barcode button when adding a new product', () => {
    renderDialog(null);
    expect(screen.queryByRole('button', { name: 'توليد باركود' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'طباعة الباركود' })).not.toBeInTheDocument();
  });

  it('shows only the generate button when editing a product with no barcode yet', () => {
    renderDialog({ ...BASE_PRODUCT, barcode: null });
    expect(screen.getByRole('button', { name: 'توليد باركود' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'طباعة الباركود' })).not.toBeInTheDocument();
  });

  it('shows only the print button when the product already has a saved barcode', () => {
    renderDialog({ ...BASE_PRODUCT, barcode: '200000000005' });
    expect(screen.queryByRole('button', { name: 'توليد باركود' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'طباعة الباركود' })).toBeInTheDocument();
  });

  it('fills the barcode field with a generated code derived from the product id', async () => {
    renderDialog({ ...BASE_PRODUCT, barcode: null });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'توليد باركود' }));

    expect(screen.getByLabelText('الباركود')).toHaveValue('200000000005');
  });
});
