import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Barcode, Camera, Printer, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import type { Category, Product } from '@pharmacy/shared-types';
import styles from './ProductDialog.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { generateInternalBarcode } from '../lib/barcode.js';
import { cleanIpcError, digitsOnly, productImageUrl } from '../lib/cx';
import { reformatPriceInput } from '../lib/priceInput.js';
import { newCaptureFilename } from '../lib/alternativePick';

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
  const [printingBarcode, setPrintingBarcode] = useState(false);
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
            salePrice: reformatPriceInput(String(product.salePrice), 0).formatted,
            purchasePrice: reformatPriceInput(String(product.purchasePrice), 0).formatted,
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
    // Reopening for another product must not resurface the previous one's QR
    // panel (and mint a capture token for this product nobody asked for).
    setPhoneCaptureOpen(false);
  }, [open, product]);

  // Each preview is a blob URL holding the picked file in memory until revoked.
  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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

  /**
   * Live thousands-separator formatting (see lib/priceInput.ts) — the only
   * fiddly part is that reformatting on every keystroke would otherwise
   * throw the cursor to the end of the field each time a comma shifts;
   * restoring the caret has to wait until the browser has actually painted
   * the newly-formatted value, hence the rAF instead of doing it inline.
   */
  function handlePriceChange(key: 'salePrice' | 'purchasePrice') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const cursorPos = input.selectionStart ?? input.value.length;
      const { formatted, cursorPos: newCursorPos } = reformatPriceInput(input.value, cursorPos);
      set(key)(formatted);
      requestAnimationFrame(() => {
        input.setSelectionRange(newCursorPos, newCursorPos);
      });
    };
  }

  function pickImage(file: File) {
    setPendingImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const salePrice = Number(form.salePrice.replace(/,/g, ''));
    const purchasePrice = Number(form.purchasePrice.replace(/,/g, ''));
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

  function startPhoneCapture() {
    if (!product) return;
    // PhoneCaptureNotice mints its own token (it needs the URL and TTL
    // anyway) — minting a second one here just to check for an error was
    // pointless, and its result was thrown away either way.
    setPhoneCaptureOpen(true);
  }

  function generateBarcode() {
    if (!product) return;
    set('barcode')(generateInternalBarcode(product.id));
  }

  async function printBarcode() {
    // Reads the product's own saved barcode, not the (possibly unsaved)
    // draft field — printing a code the product doesn't actually carry yet
    // would hand out a label nothing in the system recognizes.
    if (!product?.barcode) return;
    setPrintingBarcode(true);
    try {
      await window.pharmacy.printBarcodeLabel({ barcode: product.barcode, productName: product.name });
      toast.success('أُرسلت الطباعة');
    } catch (err) {
      toast.error('تعذّر الطباعة', cleanIpcError((err as Error).message));
    } finally {
      setPrintingBarcode(false);
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Cleared so picking the same file again (after an error) still fires onChange.
                e.target.value = '';
                if (file) pickImage(file);
              }}
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
          label="اسم الدواء"
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          required
          autoFocus
        />

        <div className={styles.row}>
          <div className={styles.field}>
            <Input
              label="الباركود"
              value={form.barcode}
              onChange={(e) => set('barcode')(e.target.value)}
              dir="ltr"
              hint="امسح الباركود بالقارئ مباشرة"
            />
            {product && (
              <div className={styles.barcodeActions}>
                {!form.barcode && (
                  <Button type="button" variant="outline" size="sm" onClick={generateBarcode}>
                    <Barcode size={14} />
                    توليد باركود
                  </Button>
                )}
                {product.barcode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={printingBarcode}
                    onClick={printBarcode}
                  >
                    <Printer size={14} />
                    طباعة الباركود
                  </Button>
                )}
              </div>
            )}
          </div>
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
            inputMode="numeric"
            dir="ltr"
            value={form.purchasePrice}
            onChange={handlePriceChange('purchasePrice')}
            required
          />
          <Input
            label="سعر البيع"
            inputMode="numeric"
            dir="ltr"
            value={form.salePrice}
            onChange={handlePriceChange('salePrice')}
            required
          />
        </div>
      </form>

      {phoneCaptureOpen && product && (
        <PhoneCaptureNotice
          productId={product.id}
          initialFilename={product.imageFilename}
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

/**
 * Polls the product record until its image shows up — the phone uploads
 * straight to the server, this window never talks to the phone directly.
 * The capture token is short-lived (server-defined TTL, ~10 minutes); this
 * used to fetch that TTL and discard it, polling forever even after the QR
 * on screen was already dead — the phone would get a clear "expired" error,
 * but nothing here ever told the person standing at the till.
 */
export function PhoneCaptureNotice({
  productId,
  initialFilename = null,
  onClose,
  onCaptured,
}: {
  productId: number;
  /** The photo the product had when the QR code was shown — the poll waits for a different one. */
  initialFilename?: string | null;
  onClose: () => void;
  onCaptured: (filename: string) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    setExpired(false);
    setMintError(null);
    setQrUrl(null);

    api.createCaptureToken(productId).then(
      (token) => {
        if (cancelled) return;
        setQrUrl(token.url);
        const expiresAt = Date.now() + token.expiresInSeconds * 1000;
        pollTimer = window.setInterval(async () => {
          if (Date.now() >= expiresAt) {
            window.clearInterval(pollTimer);
            setExpired(true);
            return;
          }
          const fresh = await api.productById(productId).catch(() => null);
          const captured = newCaptureFilename(initialFilename, fresh?.imageFilename ?? null);
          if (captured) {
            window.clearInterval(pollTimer);
            onCaptured(captured);
          }
        }, 3000);
      },
      (err: Error) => {
        if (!cancelled) setMintError(err.message);
      },
    );

    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, attempt]);

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
      {mintError ? (
        <>
          <p>{mintError}</p>
          <Button onClick={() => setAttempt((a) => a + 1)}>إعادة المحاولة</Button>
        </>
      ) : expired ? (
        <>
          <p>انتهت صلاحية رمز الالتقاط</p>
          <Button onClick={() => setAttempt((a) => a + 1)}>توليد رمز جديد</Button>
        </>
      ) : (
        <>
          <p>امسح الرمز بكاميرا الهاتف لالتقاط صورة الصنف</p>
          {qrImage && <img src={qrImage} alt="رمز QR لالتقاط الصورة" className={styles.captureQr} />}
          {qrUrl && <code className={styles.captureUrl}>{qrUrl}</code>}
        </>
      )}
      <Button variant="ghost" onClick={onClose}>
        إغلاق
      </Button>
    </div>
  );
}
