import { describe, expect, it } from 'vitest';
import { REQUIRED_LABELS, validateProductForm, type ProductFormValues } from './productValidation';

const COMPLETE: ProductFormValues = {
  name: 'بنادول',
  barcode: '204718293652',
  categoryId: '3',
  salePrice: '2,000',
  purchasePrice: '1,250',
  reorderLevel: '10',
  divisible: false,
  unitsPerPackage: '',
  subUnitName: '',
  subUnitPrice: '',
};

describe('validateProductForm', () => {
  it('accepts a complete form', () => {
    expect(validateProductForm(COMPLETE)).toEqual({});
  });

  it('names every main field that was left out, all at once', () => {
    const errors = validateProductForm({
      ...COMPLETE,
      name: '  ',
      barcode: '',
      categoryId: '',
      salePrice: '',
      purchasePrice: '',
      reorderLevel: '',
    });

    expect(Object.keys(errors).sort()).toEqual(
      ['barcode', 'categoryId', 'name', 'purchasePrice', 'reorderLevel', 'salePrice'].sort(),
    );
    expect(errors.barcode).toContain('توليد باركود');
  });

  it('refuses a zero price — nothing is sold or bought for free', () => {
    const errors = validateProductForm({ ...COMPLETE, salePrice: '0', purchasePrice: '0' });
    expect(Object.keys(errors).sort()).toEqual(['purchasePrice', 'salePrice']);
  });

  it('accepts a reorder level of 0 typed on purpose, but not an empty one', () => {
    expect(validateProductForm({ ...COMPLETE, reorderLevel: '0' })).toEqual({});
    expect(validateProductForm({ ...COMPLETE, reorderLevel: '' })).toHaveProperty('reorderLevel');
  });

  it('keeps the existing rules for a divisible product', () => {
    const errors = validateProductForm({ ...COMPLETE, divisible: true, unitsPerPackage: '1', subUnitName: '' });
    expect(Object.keys(errors).sort()).toEqual(['subUnitName', 'unitsPerPackage']);
  });

  it('has an Arabic label for every field it can flag', () => {
    const errors = validateProductForm({
      ...COMPLETE,
      name: '',
      barcode: '',
      categoryId: '',
      salePrice: '',
      purchasePrice: '',
      reorderLevel: '',
    });
    for (const field of Object.keys(errors)) expect(REQUIRED_LABELS[field as keyof typeof REQUIRED_LABELS]).toBeTruthy();
  });
});
