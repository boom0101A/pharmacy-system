import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import styles from './ProductDialog.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { digitsOnly, productImageUrl } from '../lib/cx';
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
export function ProductDialog({ open, onOpenChange, product, onSaved, onCloseAutoFocus }) {
    const toast = useToast();
    const [form, setForm] = useState(EMPTY);
    const [categories, setCategories] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const ingredientListId = useId();
    const [saving, setSaving] = useState(false);
    const [imageFilename, setImageFilename] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [phoneCaptureOpen, setPhoneCaptureOpen] = useState(false);
    // Only used while creating: the chosen picture and its local preview URL.
    const [pendingImage, setPendingImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        api.categories().then(setCategories).catch(() => setCategories([]));
        // Suggestions only — a failure here must not block adding a product.
        api.productIngredients().then(setIngredients).catch(() => setIngredients([]));
        setForm(product
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
            : EMPTY);
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
        if (!open || saving)
            return;
        function onKeyDown(event) {
            if (event.key !== 'F2')
                return;
            event.preventDefault();
            const formEl = document.getElementById('product-form');
            formEl?.requestSubmit();
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, saving]);
    function set(key) {
        return (value) => setForm((f) => ({ ...f, [key]: value }));
    }
    function pickImage(file) {
        setPendingImage(file);
        setImagePreview(URL.createObjectURL(file));
    }
    async function handleSubmit(event) {
        event.preventDefault();
        const salePrice = Number(form.salePrice);
        const purchasePrice = Number(form.purchasePrice);
        const reorderLevel = Number(form.reorderLevel);
        if (!Number.isFinite(salePrice) || salePrice < 0)
            return toast.error('سعر البيع غير صالح', 'أدخل رقماً صحيحاً');
        if (!Number.isFinite(purchasePrice) || purchasePrice < 0)
            return toast.error('سعر الشراء غير صالح', 'أدخل رقماً صحيحاً');
        if (!Number.isFinite(reorderLevel) || reorderLevel < 0)
            return toast.error('حد إعادة الطلب غير صالح', 'أدخل رقماً صحيحاً');
        let unitsPerPackage = null;
        let subUnitPrice = null;
        if (form.divisible) {
            unitsPerPackage = Number(form.unitsPerPackage);
            if (!Number.isInteger(unitsPerPackage) || unitsPerPackage < 2) {
                return toast.error('عدد الأشرطة بالعلبة غير صالح', 'أدخل رقماً صحيحاً 2 أو أكثر');
            }
            if (!form.subUnitName.trim())
                return toast.error('اسم الوحدة الفرعية مطلوب', 'مثال: شريط');
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
                }
                catch (err) {
                    toast.error('حُفظ الصنف لكن تعذّر رفع الصورة', err.message);
                }
                finally {
                    setUploadingImage(false);
                }
            }
            toast.success(product ? 'تم تحديث الصنف' : 'تمت إضافة الصنف');
            onSaved();
            onOpenChange(false);
        }
        catch (err) {
            toast.error('تعذّر الحفظ', err.message);
        }
        finally {
            setSaving(false);
        }
    }
    async function startPhoneCapture() {
        if (!product)
            return;
        setPhoneCaptureOpen(true);
        try {
            await api.createCaptureToken(product.id);
        }
        catch (err) {
            toast.error('تعذّر إنشاء رمز الالتقاط', err.message);
            setPhoneCaptureOpen(false);
        }
    }
    return (_jsxs(Dialog, { open: open, onOpenChange: onOpenChange, onCloseAutoFocus: onCloseAutoFocus, title: product ? 'تعديل صنف' : 'صنف جديد', description: product ? undefined : 'الكمية تُدخل لاحقاً عبر "إدخال كمية" مع تاريخ الانتهاء', footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: "\u0625\u0644\u063A\u0627\u0621" }), _jsx(Button, { form: "product-form", type: "submit", disabled: saving, title: "F2", children: saving ? 'جارٍ الحفظ…' : 'حفظ' })] }), children: [_jsxs("form", { id: "product-form", className: styles.formGrid, onSubmit: handleSubmit, children: [_jsxs("div", { className: styles.imageRow, children: [_jsx("div", { className: styles.imagePreview, children: imagePreview || imageFilename ? (_jsx("img", { src: imagePreview ?? productImageUrl(imageFilename), alt: "" })) : (_jsx("span", { className: styles.thumb, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631\u0629" })) }), _jsxs("div", { className: styles.imageActions, children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", hidden: true, onChange: (e) => e.target.files?.[0] && pickImage(e.target.files[0]) }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: uploadingImage, onClick: () => fileInputRef.current?.click(), children: [_jsx(Upload, { size: 14 }), "\u0627\u062E\u062A\u064A\u0627\u0631 \u0635\u0648\u0631\u0629"] }), product && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: startPhoneCapture, children: [_jsx(Camera, { size: 14 }), "\u0627\u0644\u062A\u0642\u0627\u0637 \u0628\u0627\u0644\u0647\u0627\u062A\u0641"] }))] })] }), _jsx(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641", value: form.name, onChange: (e) => set('name')(e.target.value), required: true, autoFocus: true }), _jsxs("div", { className: styles.row, children: [_jsx(Input, { label: "\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F", value: form.barcode, onChange: (e) => set('barcode')(e.target.value), dir: "ltr", hint: "\u0627\u0645\u0633\u062D \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0628\u0627\u0644\u0642\u0627\u0631\u0626 \u0645\u0628\u0627\u0634\u0631\u0629" }), _jsxs("div", { className: styles.field, children: [_jsx("label", { className: styles.label, htmlFor: "product-category", children: "\u0627\u0644\u062A\u0635\u0646\u064A\u0641" }), _jsxs("select", { id: "product-category", className: styles.select, value: form.categoryId, onChange: (e) => set('categoryId')(e.target.value), children: [_jsx("option", { value: "", children: "\u0628\u062F\u0648\u0646 \u062A\u0635\u0646\u064A\u0641" }), categories.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] })] }), _jsx(Input, { label: "\u0627\u0644\u0648\u062D\u062F\u0629", value: form.unit, onChange: (e) => set('unit')(e.target.value), hint: "\u0639\u0644\u0628\u0629 / \u0634\u0631\u064A\u0637 / \u062D\u0628\u0629" }), _jsxs("div", { className: styles.row, children: [_jsxs("div", { className: styles.field, children: [_jsx("label", { className: styles.label, htmlFor: "product-ingredient", children: "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629" }), _jsx("input", { id: "product-ingredient", className: styles.input, list: ingredientListId, value: form.activeIngredient, onChange: (e) => set('activeIngredient')(e.target.value) }), _jsx("datalist", { id: ingredientListId, children: ingredients.map((i) => (_jsx("option", { value: i }, i))) }), _jsx("span", { className: styles.hint, children: "\u0627\u0643\u062A\u0628 \u0623\u0648 \u0627\u062E\u062A\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u062C\u0644 \u2014 \u0646\u0641\u0633 \u0627\u0644\u0643\u062A\u0627\u0628\u0629 \u062A\u0639\u0646\u064A \u0628\u062F\u064A\u0644\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B" })] }), _jsx(Input, { label: "\u0627\u0644\u062A\u0631\u0643\u064A\u0632", value: form.strength, onChange: (e) => set('strength')(e.target.value), placeholder: "500 \u0645\u063A" })] }), _jsx(Input, { label: "\u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u062F\u0648\u0627\u0626\u064A", value: form.dosageForm, onChange: (e) => set('dosageForm')(e.target.value), placeholder: "\u0623\u0642\u0631\u0627\u0635 / \u0634\u0631\u0627\u0628 / \u0645\u0631\u0647\u0645" }), _jsxs("label", { className: styles.checkboxRow, children: [_jsx("input", { type: "checkbox", checked: form.divisible, onChange: (e) => set('divisible')(e.target.checked) }), "\u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u062C\u0632\u0626\u0629 (\u0628\u064A\u0639 \u0648\u062D\u062F\u0629 \u0641\u0631\u0639\u064A\u0629 \u0645\u062B\u0644 \u0634\u0631\u064A\u0637 \u0645\u0646 \u0627\u0644\u0639\u0644\u0628\u0629)"] }), form.divisible && (_jsxs("div", { className: styles.row, children: [_jsx(Input, { label: "\u0639\u062F\u062F \u0627\u0644\u0623\u0634\u0631\u0637\u0629 \u0628\u0627\u0644\u0639\u0644\u0628\u0629", inputMode: "numeric", value: form.unitsPerPackage, onChange: (e) => set('unitsPerPackage')(digitsOnly(e.target.value)) }), _jsx(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0641\u0631\u0639\u064A\u0629", value: form.subUnitName, onChange: (e) => set('subUnitName')(e.target.value), placeholder: "\u0634\u0631\u064A\u0637" })] })), form.divisible && (_jsx(Input, { label: "\u0633\u0639\u0631 \u0628\u064A\u0639 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0641\u0631\u0639\u064A\u0629", inputMode: "decimal", value: form.subUnitPrice, onChange: (e) => set('subUnitPrice')(e.target.value) })), _jsxs("div", { className: styles.row, children: [_jsx(Input, { label: "\u062D\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628", inputMode: "numeric", value: form.reorderLevel, onChange: (e) => set('reorderLevel')(digitsOnly(e.target.value)), hint: "\u064A\u0646\u0628\u0651\u0647 \u0627\u0644\u0646\u0638\u0627\u0645 \u0639\u0646\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0643\u0645\u064A\u0629" }), _jsx(Input, { label: "\u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621", inputMode: "decimal", value: form.purchasePrice, onChange: (e) => set('purchasePrice')(e.target.value), required: true }), _jsx(Input, { label: "\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639", inputMode: "decimal", value: form.salePrice, onChange: (e) => set('salePrice')(e.target.value), required: true })] })] }), phoneCaptureOpen && product && (_jsx(PhoneCaptureNotice, { productId: product.id, onClose: () => setPhoneCaptureOpen(false), onCaptured: (filename) => {
                    setImageFilename(filename);
                    setPhoneCaptureOpen(false);
                } }))] }));
}
/** Polls the product record until its image shows up — the phone uploads straight to the server, this window never talks to the phone directly. */
function PhoneCaptureNotice({ productId, onClose, onCaptured, }) {
    const [qrUrl, setQrUrl] = useState(null);
    const [qrImage, setQrImage] = useState(null);
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
        if (!qrUrl)
            return;
        let cancelled = false;
        QRCode.toDataURL(qrUrl, { width: 220, margin: 1 })
            .then((dataUrl) => {
            if (!cancelled)
                setQrImage(dataUrl);
        })
            .catch(() => {
            if (!cancelled)
                setQrImage(null);
        });
        return () => {
            cancelled = true;
        };
    }, [qrUrl]);
    return (_jsxs("div", { className: styles.captureOverlay, children: [_jsx("p", { children: "\u0627\u0645\u0633\u062D \u0627\u0644\u0631\u0645\u0632 \u0628\u0643\u0627\u0645\u064A\u0631\u0627 \u0627\u0644\u0647\u0627\u062A\u0641 \u0644\u0627\u0644\u062A\u0642\u0627\u0637 \u0635\u0648\u0631\u0629 \u0627\u0644\u0635\u0646\u0641" }), qrImage && _jsx("img", { src: qrImage, alt: "\u0631\u0645\u0632 QR \u0644\u0627\u0644\u062A\u0642\u0627\u0637 \u0627\u0644\u0635\u0648\u0631\u0629", className: styles.captureQr }), qrUrl && _jsx("code", { className: styles.captureUrl, children: qrUrl }), _jsx(Button, { variant: "ghost", onClick: onClose, children: "\u0625\u063A\u0644\u0627\u0642" })] }));
}
