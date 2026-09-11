import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Camera, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import type { Category, Product } from '@pharmacy/shared-types';
import styles from './ProductDialog.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { digitsOnly, productImageUrl } from '../lib/cx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null means "add a new product". */
  product: Product | null;
  onSaved: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

const EMPTY = {
  name: '',
  barcode: '',
  categoryId: '',
  unit: 'علبة',
  salePrice: '',
  purchasePrice: '',
  reorderLevel: '10',
  activeIngredient: '',
  dosageForm: '',
  strength: '',
  divisible: false,
  unitsPerPackage: '',
  subUnitName: '',
  subUnitPrice: '',
};

export function ProductDialog({ open, onOpenChange, product, onSaved, onCloseAutoFocus }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const ingredientListId = useId();
  const [saving, setSaving] = useState(false);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [phoneCaptureOpen, setPhoneCaptureOpen] = useState(false);
  // Only used while creating: the chosen picture and its local preview URL.
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    api.categories().then(setCategories).catch(() => setCategories([]));
    // Suggestions only — a failure here must not block adding a product.
    api.productIngredients().then(setIngredients).catch(() => setIngredients([]));

    setForm(
      product
        ? {
            name: product.name,
            barcode: product.barcode ?? '',
            categoryId: product.categoryId ? String(product.categoryId) : '',
            unit: product.unit,
            salePrice: String(product.salePrice),
            purchasePrice: String(product.purchasePrice),
            reorderLevel: String(product.reorderLevel),
            activeIngredient: product.activeIngredient ?? '',
            dosageForm: product.dosageForm ?? '',
            strength: product.strength ?? '',
            divisible: product.unitsPerPackage !== null,
            unitsPerPackage: product.unitsPerPackage ? String(product.unitsPerPackage) : '',
            subUnitName: product.subUnitName ?? '',
            subUnitPrice: product.subUnitPrice !== null ? String(product.subUnitPrice) : '',
          }
        : EMPTY,
    );
    setImageFilename(product?.imageFilename ?? null);
    setPendingImage(null);
    setImagePreview(null);
  }, [open, product]);

  /**
   * F2 saves, from any field in the form — the counterpart to F1 opening it.
   * requestSubmit() rather than calling handleSubmit directly so the browser
   * still runs the fields' own `required`/validity checks first, exactly as a
   * click on the save button would.
   */
  useEffect(() => {
    if (!open || saving) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'F2') return;
      event.preventDefault();
      const formEl = document.getElementById('product-form');
      (formEl as HTMLFormElement | null)?.requestSubmit();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving]);

  function set<K extends keyof typeof EMPTY>(key: K) {
    return (value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));
  }

  function pickImage(file: File) {
    setPendingImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const salePrice = Number(form.salePrice);
    const purchasePrice = Number(form.purchasePrice);
    const reorderLevel = Number(form.reorderLevel);
    if (!Number.isFinite(salePrice) || salePrice < 0) return toast.error('سعر البيع غير صالح', 'أدخل رقماً صحيحاً');
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) return toast.error('سعر الشراء غير صالح', 'أدخل رقماً صحيحاً');
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) return toast.error('حد إعادة الطلب غير صالح', 'أدخل رقماً صحيحاً');

    let unitsPerPackage: number | null = null;
    let subUnitPrice: number | null = null;
    if (form.divisible) {
      unitsPerPackage = Number(form.unitsPerPackage);
      if (!Number.isInteger(unitsPerPackage) || unitsPerPackage < 2) {
        return toast.error('عدد الأشرطة بالعلبة غير صالح', 'أدخل رقماً صحيحاً 2 أو أكثر');
      }
      if (!form.subUnitName.trim()) return toast.error('اسم الوحدة الفرعية مطلوب', 'مثال: شريط');
      subUnitPrice = Number(form.subUnitPrice);
      if (!Number.isFinite(subUnitPrice) || subUnitPrice < 0) {
        return toast.error('سعر بيع الوحدة الفرعية غير صالح', 'أدخل رقماً صحيحاً');
      }
    }

    const data = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit.trim() || 'علبة',
      salePrice,
      purchasePrice,
      reorderLevel,
      activeIngredient: form.activeIngredient.trim() || null,
      dosageForm: form.dosageForm.trim() || null,
      strength: form.strength.trim() || null,
      unitsPerPackage,
      subUnitName: form.divisible ? form.subUnitName.trim() : null,
      subUnitPrice,
    };

    setSaving(true);
    try {
      const saved = product ? await api.updateProduct(product.id, data) : await api.createProduct(data);
      if (pendingImage) {
        setUploadingImage(true);
        try {
          await api.uploadProductImage(saved.id, pendingImage);
        } catch (err) {
          toast.error('حُفظ الصنف لكن تعذّر رفع الصورة', (err as Error).message);
        } finally {
          setUploadingImage(false);
        }
      }
      toast.success(product ? 'تم تحديث الصنف' : 'تمت إضافة الصنف');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error('تعذّر الحفظ', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function startPhoneCapture() {
    if (!product) return;
    setPhoneCaptureOpen(true);
    try {
      await api.createCaptureToken(product.id);
    } catch (err) {
      toast.error('تعذّر إنشاء رمز الالتقاط', (err as Error).message);
      setPhoneCaptureOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={product ? 'تعديل صنف' : 'صنف جديد'}
      description={
        product ? undefined : 'الكمية تُدخل لاحقاً عبر "إدخال كمية" مع تاريخ الانتهاء'
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button form="product-form" type="submit" disabled={saving} title="F2">
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </>
      }
    >
      <form id="product-form" className={styles.formGrid} onSubmit={handleSubmit}>
        <div className={styles.imageRow}>
          <div className={styles.imagePreview}>
            {imagePreview || imageFilename ? (
              <img src={imagePreview ?? productImageUrl(imageFilename)!} alt="" />
            ) : (
              <span className={styles.thumb}>لا توجد صورة</span>
            )}
          </div>
          <div className={styles.imageActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              اختيار صورة
            </Button>
            {product && (
              <Button type="button" variant="outline" size="sm" onClick={startPhoneCapture}>
                <Camera size={14} />
                التقاط بالهاتف
              </Button>
            )}
          </div>
        </div>

        <Input
          label="اسم الصنف"
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          required
          autoFocus
        />

        <div className={styles.row}>
          <Input
            label="الباركود"
            value={form.barcode}
            onChange={(e) => set('barcode')(e.target.value)}
            dir="ltr"
            hint="امسح الباركود بالقارئ مباشرة"
          />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-category">
              التصنيف
            </label>
            <select
              id="product-category"
              className={styles.select}
              value={form.categoryId}
              onChange={(e) => set('categoryId')(e.target.value)}
            >
              <option value="">بدون تصنيف</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="الوحدة"
          value={form.unit}
          onChange={(e) => set('unit')(e.target.value)}
          hint="علبة / شريط / حبة"
        />

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-ingredient">
              المادة الفعالة
            </label>
            <input
              id="product-ingredient"
              className={styles.input}
              list={ingredientListId}
              value={form.activeIngredient}
              onChange={(e) => set('activeIngredient')(e.target.value)}
            />
            <datalist id={ingredientListId}>
              {ingredients.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
            <span className={styles.hint}>اكتب أو اختر من المسجل — نفس الكتابة تعني بديلاً صحيحاً</span>
          </div>
          <Input
            label="التركيز"
            value={form.strength}
            onChange={(e) => set('strength')(e.target.value)}
            placeholder="500 مغ"
          />
        </div>

        <Input
          label="الشكل الدوائي"
          value={form.dosageForm}
          onChange={(e) => set('dosageForm')(e.target.value)}
          placeholder="أقراص / شراب / مرهم"
        />

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.divisible}
            onChange={(e) => set('divisible')(e.target.checked)}
          />
          قابل للتجزئة (بيع وحدة فرعية مثل شريط من العلبة)
        </label>

        {form.divisible && (
          <div className={styles.row}>
            <Input
              label="عدد الأشرطة بالعلبة"
              inputMode="numeric"
              value={form.unitsPerPackage}
              onChange={(e) => set('unitsPerPackage')(digitsOnly(e.target.value))}
            />
            <Input
              label="اسم الوحدة الفرعية"
              value={form.subUnitName}
              onChange={(e) => set('subUnitName')(e.target.value)}
              placeholder="شريط"
            />
          </div>
        )}

        {form.divisible && (
          <Input
            label="سعر بيع الوحدة الفرعية"
            inputMode="decimal"
            value={form.subUnitPrice}
            onChange={(e) => set('subUnitPrice')(e.target.value)}
          />
        )}

        <div className={styles.row}>
          <Input
            label="حد إعادة الطلب"
            inputMode="numeric"
            value={form.reorderLevel}
            onChange={(e) => set('reorderLevel')(digitsOnly(e.target.value))}
            hint="ينبّه النظام عند الوصول لهذه الكمية"
          />
          <Input
            label="سعر الشراء"
            inputMode="decimal"
            value={form.purchasePrice}
            onChange={(e) => set('purchasePrice')(e.target.value)}
            required
          />
          <Input
            label="سعر البيع"
            inputMode="decimal"
            value={form.salePrice}
            onChange={(e) => set('salePrice')(e.target.value)}
            required
          />
        </div>
      </form>

      {phoneCaptureOpen && product && (
        <PhoneCaptureNotice
          productId={product.id}
          onClose={() => setPhoneCaptureOpen(false)}
          onCaptured={(filename) => {
            setImageFilename(filename);
            setPhoneCaptureOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

/** Polls the product record until its image shows up — the phone uploads straight to the server, this window never talks to the phone directly. */
function PhoneCaptureNotice({
  productId,
  onClose,
  onCaptured,
}: {
  productId: number;
  onClose: () => void;
  onCaptured: (filename: string) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  useEffect(() => {
    api.createCaptureToken(productId).then((r) => setQrUrl(r.url));
    const timer = window.setInterval(async () => {
      const rows = await api.products().catch(() => []);
      const fresh = rows.find((p) => p.id === productId);
      if (fresh?.imageFilename) {
        window.clearInterval(timer);
        onCaptured(fresh.imageFilename);
      }
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (!qrUrl) return;
    let cancelled = false;
    QRCode.toDataURL(qrUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrImage(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  return (
    <div className={styles.captureOverlay}>
      <p>امسح الرمز بكاميرا الهاتف لالتقاط صورة الصنف</p>
      {qrImage && <img src={qrImage} alt="رمز QR لالتقاط الصورة" className={styles.captureQr} />}
      {qrUrl && <code className={styles.captureUrl}>{qrUrl}</code>}
      <Button variant="ghost" onClick={onClose}>
        إغلاق
      </Button>
    </div>
  );
}
