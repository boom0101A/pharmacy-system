// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@pharmacy/shared-types';

vi.mock('../lib/api.js', () => ({
  api: {
    categories: vi.fn().mockResolvedValue([]),
    productIngredients: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    newBarcode: vi.fn(),
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

describe('ProductDialog money fields', () => {
  it('shows every price with thousands separators, the strip price included', () => {
    renderDialog({ ...BASE_PRODUCT, salePrice: 16000, purchasePrice: 9000, unitsPerPackage: 2, subUnitName: 'شريط', subUnitPrice: 1000 });

    expect((screen.getByLabelText('سعر البيع') as HTMLInputElement).value).toBe('16,000');
    expect((screen.getByLabelText('سعر الشراء') as HTMLInputElement).value).toBe('9,000');
    expect((screen.getByLabelText('سعر بيع الوحدة الفرعية') as HTMLInputElement).value).toBe('1,000');
  });

  it('formats the strip price while typing and saves it as a plain number', async () => {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.updateProduct).mockResolvedValue({ ...BASE_PRODUCT });
    renderDialog({ ...BASE_PRODUCT, barcode: '200000000017', categoryId: 3, unitsPerPackage: 2, subUnitName: 'شريط', subUnitPrice: 1000 });
    const strip = screen.getByLabelText('سعر بيع الوحدة الفرعية') as HTMLInputElement;

    fireEvent.change(strip, { target: { value: '1500' } });
    expect(strip.value).toBe('1,500');
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(api.updateProduct).toHaveBeenCalled());
    expect(vi.mocked(api.updateProduct).mock.calls[0][1]).toMatchObject({ subUnitPrice: 1500 });
  });
});

describe('ProductDialog barcode actions', () => {
  it('offers to generate a barcode for a brand-new product too, but not to print one', () => {
    renderDialog(null);
    expect(screen.getByRole('button', { name: 'توليد باركود' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'طباعة الباركود' })).not.toBeInTheDocument();
  });

  it('fills a new product\'s barcode with the unique code the server hands out', async () => {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.newBarcode).mockResolvedValue({ barcode: '204718293652' });
    renderDialog(null);

    fireEvent.click(screen.getByRole('button', { name: 'توليد باركود' }));

    await waitFor(() => expect(screen.getByLabelText('الباركود')).toHaveValue('204718293652'));
    expect(screen.queryByRole('button', { name: 'توليد باركود' })).not.toBeInTheDocument();
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

  it('fills a saved product\'s empty barcode the same way', async () => {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.newBarcode).mockResolvedValue({ barcode: '209999999993' });
    renderDialog({ ...BASE_PRODUCT, barcode: null });

    fireEvent.click(screen.getByRole('button', { name: 'توليد باركود' }));

    await waitFor(() => expect(screen.getByLabelText('الباركود')).toHaveValue('209999999993'));
  });
});

describe('ProductDialog — required fields', () => {
  it('marks every forgotten main field at once and saves nothing', async () => {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.createProduct).mockClear();
    renderDialog(null);
    fireEvent.change(screen.getByLabelText('حد إعادة الطلب'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    const summary = await screen.findByText(/نسيت 6 خانات/);
    expect(summary.textContent).toContain('التصنيف');
    expect(screen.getByText('اسم الدواء مطلوب')).toBeTruthy();
    expect(screen.getByText(/الباركود مطلوب/)).toBeTruthy();
    expect(screen.getByText('اختر تصنيف الدواء')).toBeTruthy();
    expect(screen.getByText('سعر الشراء مطلوب')).toBeTruthy();
    expect(screen.getByText('سعر البيع مطلوب')).toBeTruthy();
    expect(screen.getByText(/حد إعادة الطلب مطلوب/)).toBeTruthy();
    expect(api.createProduct).not.toHaveBeenCalled();
  });

  it('clears a field’s message as soon as it is filled in', async () => {
    renderDialog(null);
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await screen.findByText('اسم الدواء مطلوب');

    fireEvent.change(screen.getByLabelText('اسم الدواء'), { target: { value: 'بنادول' } });

    expect(screen.queryByText('اسم الدواء مطلوب')).toBeNull();
  });

  it('asks for the barcode when an older product without one is edited', async () => {
    const { api } = await import('../lib/api.js');
    vi.mocked(api.updateProduct).mockClear();
    renderDialog({ ...BASE_PRODUCT, barcode: null, categoryId: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    expect(await screen.findByText(/الباركود مطلوب/)).toBeTruthy();
    expect(api.updateProduct).not.toHaveBeenCalled();
  });
});
