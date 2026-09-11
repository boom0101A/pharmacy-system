import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Building2, Download, Printer, Save, Server, Trash2, Upload } from 'lucide-react';
import styles from './Settings.module.css';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api, getServerUrl, setServerUrl } from '../lib/api';
import { useBranding } from '../store/branding';
import { cleanIpcError, formatDate } from '../lib/cx';
const MAX_LOGO_BYTES = 8 * 1024 * 1024;
export function Settings() {
    const toast = useToast();
    const [server, setServer] = useState(getServerUrl());
    const logoUrl = useBranding((s) => s.logoUrl);
    const refreshLogo = useBranding((s) => s.refresh);
    const logoInputRef = useRef(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [confirmDeleteLogo, setConfirmDeleteLogo] = useState(false);
    const [pharmacyName, setPharmacyName] = useState('');
    const [pharmacyAddress, setPharmacyAddress] = useState('');
    const [pharmacyPhone, setPharmacyPhone] = useState('');
    const [savingPharmacy, setSavingPharmacy] = useState(false);
    const [printerPath, setPrinterPath] = useState('');
    const [savingPrinter, setSavingPrinter] = useState(false);
    const [testing, setTesting] = useState(false);
    const [backups, setBackups] = useState([]);
    const [downloadingBackup, setDownloadingBackup] = useState(null);
    useEffect(() => {
        window.pharmacy.getSettings().then((s) => {
            setPrinterPath(s.printerPath ?? '');
            setPharmacyName(s.pharmacyName ?? '');
            setPharmacyAddress(s.pharmacyAddress ?? '');
            setPharmacyPhone(s.pharmacyPhone ?? '');
        });
        api.backups().then(setBackups).catch(() => setBackups([]));
    }, []);
    function saveServer() {
        setServerUrl(server);
        toast.success('تم حفظ عنوان الخادم');
    }
    async function pickLogo(file) {
        if (!file.type.startsWith('image/')) {
            toast.error('تعذّر رفع الشعار', 'الملف المختار ليس صورة');
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            toast.error('تعذّر رفع الشعار', 'حجم الصورة أكبر من الحد المسموح (8 ميغابايت)');
            return;
        }
        setUploadingLogo(true);
        try {
            await api.uploadLogo(file);
            await refreshLogo();
            toast.success('تم رفع الشعار — يظهر الآن في كل أجهزة الصيدلية على الشبكة');
        }
        catch (err) {
            toast.error('تعذّر رفع الشعار', err.message);
        }
        finally {
            setUploadingLogo(false);
        }
    }
    async function removeLogo() {
        setConfirmDeleteLogo(false);
        try {
            await api.deleteLogo();
            await refreshLogo();
            toast.success('تم حذف الشعار');
        }
        catch (err) {
            toast.error('تعذّر حذف الشعار', err.message);
        }
    }
    async function savePharmacyInfo() {
        setSavingPharmacy(true);
        try {
            await window.pharmacy.setSettings({
                pharmacyName: pharmacyName.trim() || null,
                pharmacyAddress: pharmacyAddress.trim() || null,
                pharmacyPhone: pharmacyPhone.trim() || null,
            });
            toast.success('تم حفظ بيانات الصيدلية');
        }
        catch (err) {
            toast.error('تعذّر الحفظ', cleanIpcError(err.message));
        }
        finally {
            setSavingPharmacy(false);
        }
    }
    async function savePrinter() {
        setSavingPrinter(true);
        try {
            await window.pharmacy.setSettings({ printerPath: printerPath.trim() || null });
            toast.success('تم حفظ منفذ الطابعة');
        }
        catch (err) {
            toast.error('تعذّر الحفظ', cleanIpcError(err.message));
        }
        finally {
            setSavingPrinter(false);
        }
    }
    async function downloadBackup(name) {
        setDownloadingBackup(name);
        try {
            await api.downloadBackup(name);
        }
        catch (err) {
            toast.error('تعذّر تنزيل النسخة الاحتياطية', cleanIpcError(err.message));
        }
        finally {
            setDownloadingBackup(null);
        }
    }
    async function testPrint() {
        setTesting(true);
        try {
            await window.pharmacy.printReceipt({
                saleId: 0,
                date: new Date().toISOString(),
                cashierName: '',
                items: [{ productName: 'صنف تجريبي', quantity: 1, unitPrice: 1000, unitLabel: 'علبة' }],
                discount: 0,
                total: 1000,
                isTest: true,
            });
            toast.success('أُرسلت الطباعة التجريبية');
        }
        catch (err) {
            toast.error('تعذّر الطباعة', cleanIpcError(err.message));
        }
        finally {
            setTesting(false);
        }
    }
    return (_jsxs("div", { className: styles.layout, children: [_jsxs("section", { className: styles.card, children: [_jsxs("h2", { className: styles.title, children: [_jsx(Building2, { size: 18 }), "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629"] }), _jsx("p", { className: styles.hint, children: "\u062A\u064F\u0637\u0628\u0639 \u0641\u064A \u0631\u0623\u0633 \u0643\u0644 \u0625\u064A\u0635\u0627\u0644 \u2014 \u0625\u0639\u062F\u0627\u062F \u062E\u0627\u0635 \u0628\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632\u060C \u0644\u0627 \u064A\u064F\u0634\u0627\u0631\u064E\u0643 \u0645\u0639 \u0627\u0644\u062E\u0627\u062F\u0645." }), _jsxs("div", { className: styles.logoRow, children: [_jsx("div", { className: styles.logoPreview, children: logoUrl ? _jsx("img", { src: logoUrl, alt: "\u0634\u0639\u0627\u0631 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629" }) : _jsx("span", { className: styles.logoPlaceholder, children: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0634\u0639\u0627\u0631" }) }), _jsxs("div", { className: styles.logoActions, children: [_jsx("input", { ref: logoInputRef, type: "file", accept: "image/*", hidden: true, onChange: (e) => e.target.files?.[0] && pickLogo(e.target.files[0]) }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", disabled: uploadingLogo, onClick: () => logoInputRef.current?.click(), children: [_jsx(Upload, { size: 14 }), uploadingLogo ? 'جارٍ الرفع…' : 'رفع شعار'] }), logoUrl && (_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setConfirmDeleteLogo(true), children: [_jsx(Trash2, { size: 14 }), "\u062D\u0630\u0641 \u0627\u0644\u0634\u0639\u0627\u0631"] }))] }), _jsx("p", { className: styles.hint, children: "\u064A\u064F\u0631\u0641\u064E\u0639 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u064A\u0638\u0647\u0631 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0641\u064A \u0643\u0644 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0643\u0629 \u0648\u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0629." })] }), _jsx(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629", value: pharmacyName, onChange: (e) => setPharmacyName(e.target.value), placeholder: "\u0635\u064A\u062F\u0644\u064A\u0629 \u0627\u0644\u0634\u0641\u0627\u0621" }), _jsx(Input, { label: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", value: pharmacyAddress, onChange: (e) => setPharmacyAddress(e.target.value) }), _jsx(Input, { label: "\u0627\u0644\u0647\u0627\u062A\u0641", value: pharmacyPhone, onChange: (e) => setPharmacyPhone(e.target.value), dir: "ltr" }), _jsxs(Button, { onClick: savePharmacyInfo, disabled: savingPharmacy, children: [_jsx(Save, { size: 16 }), savingPharmacy ? 'جارٍ الحفظ…' : 'حفظ'] })] }), _jsxs("section", { className: styles.card, children: [_jsxs("h2", { className: styles.title, children: [_jsx(Server, { size: 18 }), "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062E\u0627\u062F\u0645"] }), _jsxs("div", { className: styles.row, children: [_jsx(Input, { value: server, onChange: (e) => setServer(e.target.value), dir: "ltr" }), _jsxs(Button, { onClick: saveServer, children: [_jsx(Save, { size: 16 }), "\u062D\u0641\u0638"] })] })] }), _jsxs("section", { className: styles.card, children: [_jsxs("h2", { className: styles.title, children: [_jsx(Printer, { size: 18 }), "\u0627\u0644\u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629"] }), _jsxs("div", { className: styles.row, children: [_jsx(Input, { value: printerPath, onChange: (e) => setPrinterPath(e.target.value), dir: "ltr", placeholder: "\u0645\u062B\u0627\u0644: USB \u0623\u0648 /dev/usb/lp0", hint: "\u0645\u0646\u0641\u0630 \u0627\u0644\u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629 \u0627\u0644\u0645\u062A\u0635\u0644\u0629 \u0628\u062C\u0647\u0627\u0632 \u0627\u0644\u0643\u0627\u0634\u064A\u0631" }), _jsxs(Button, { onClick: savePrinter, disabled: savingPrinter, children: [_jsx(Save, { size: 16 }), "\u062D\u0641\u0638"] })] }), _jsx(Button, { variant: "outline", onClick: testPrint, disabled: testing, children: testing ? 'جارٍ الطباعة…' : 'طباعة تجريبية' })] }), _jsxs("section", { className: styles.card, children: [_jsx("h2", { className: styles.title, children: "\u0622\u062E\u0631 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" }), backups.length === 0 ? (_jsx("p", { className: styles.empty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0628\u0639\u062F" })) : (_jsx("ul", { className: styles.backupList, children: backups.slice(0, 10).map((b) => (_jsxs("li", { children: [_jsx("span", { children: formatDate(b.createdAt) }), _jsxs("span", { className: "numeric", children: [Math.round(b.sizeBytes / 1024), " \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => downloadBackup(b.name), disabled: downloadingBackup === b.name, "aria-label": "\u062A\u0646\u0632\u064A\u0644 \u0647\u0630\u0647 \u0627\u0644\u0646\u0633\u062E\u0629", children: _jsx(Download, { size: 14 }) })] }, b.name))) })), _jsx("p", { className: styles.hint, children: "\u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062A\u062A\u0645 \u0645\u0646 \u062C\u0647\u0627\u0632 \u0627\u0644\u062E\u0627\u062F\u0645 \u0641\u0642\u0637 \u0639\u0628\u0631 \u0633\u0637\u0631 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u2014 \u0631\u0627\u062C\u0639 \u062F\u0644\u064A\u0644 \u0627\u0644\u062A\u0634\u063A\u064A\u0644." })] }), _jsx(ConfirmDialog, { open: confirmDeleteLogo, onOpenChange: setConfirmDeleteLogo, title: "\u062D\u0630\u0641 \u0627\u0644\u0634\u0639\u0627\u0631\u061F", description: "\u0633\u064A\u0639\u0648\u062F \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0644\u0644\u0623\u064A\u0642\u0648\u0646\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0641\u064A \u0643\u0644 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0648\u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0629\u060C \u062D\u062A\u0649 \u064A\u064F\u0631\u0641\u064E\u0639 \u0634\u0639\u0627\u0631 \u062C\u062F\u064A\u062F.", confirmLabel: "\u062D\u0630\u0641", onConfirm: removeLogo })] }));
}
