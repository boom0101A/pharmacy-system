import { parsePriceInput } from './priceInput';

export interface ProductFormValues {
  name: string;
  barcode: string;
  categoryId: string;
  salePrice: string;
  purchasePrice: string;
  reorderLevel: string;
  divisible: boolean;
  unitsPerPackage: string;
  subUnitName: string;
  subUnitPrice: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

/** Short names for the "you forgot N fields: …" summary, in form order. */
export const REQUIRED_LABELS: Partial<Record<keyof ProductFormValues, string>> = {
  name: 'اسم الدواء',
  barcode: 'الباركود',
  categoryId: 'التصنيف',
  unitsPerPackage: 'عدد الأشرطة بالعلبة',
  subUnitName: 'اسم الوحدة الفرعية',
  subUnitPrice: 'سعر بيع الوحدة الفرعية',
  reorderLevel: 'حد إعادة الطلب',
  purchasePrice: 'سعر الشراء',
  salePrice: 'سعر البيع',
};

/**
 * Every problem in the product form at once, keyed by field — the dialog
 * marks each one instead of stopping at the first. A zero price is refused
 * (profit is computed from the purchase price; nothing is sold for free); a
 * reorder level of 0 is fine as long as it was typed, not left empty.
 */
export function validateProductForm(form: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!form.name.trim()) errors.name = 'اسم الدواء مطلوب';
  if (!form.barcode.trim()) errors.barcode = 'الباركود مطلوب — امسحه بالقارئ أو اضغط «توليد باركود»';
  if (!form.categoryId) errors.categoryId = 'اختر تصنيف الدواء';

  const purchase = parsePriceInput(form.purchasePrice);
  if (purchase === null) errors.purchasePrice = 'سعر الشراء غير صالح — أدخل رقماً';
  else if (purchase <= 0) errors.purchasePrice = 'سعر الشراء مطلوب';

  const sale = parsePriceInput(form.salePrice);
  if (sale === null) errors.salePrice = 'سعر البيع غير صالح — أدخل رقماً';
  else if (sale <= 0) errors.salePrice = 'سعر البيع مطلوب';

  if (form.reorderLevel.trim() === '') errors.reorderLevel = 'حد إعادة الطلب مطلوب (اكتب 0 إن لم ترد تنبيهاً)';
  else if (!(Number(form.reorderLevel) >= 0)) errors.reorderLevel = 'حد إعادة الطلب غير صالح';

  if (form.divisible) {
    const units = Number(form.unitsPerPackage);
    if (!Number.isInteger(units) || units < 2) errors.unitsPerPackage = 'أدخل عدداً صحيحاً 2 أو أكثر';
    if (!form.subUnitName.trim()) errors.subUnitName = 'اسم الوحدة الفرعية مطلوب — مثال: شريط';
    if (parsePriceInput(form.subUnitPrice) === null) errors.subUnitPrice = 'سعر بيع الوحدة الفرعية غير صالح';
  }

  return errors;
}
