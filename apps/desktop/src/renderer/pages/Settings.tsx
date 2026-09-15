import { useEffect, useRef, useState } from 'react';
import { Building2, Download, Printer, Save, Server, ShieldCheck, Trash2, Upload, Volume2 } from 'lucide-react';
import type { BackupFile } from '@pharmacy/shared-types';
import styles from './Settings.module.css';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api, getServerUrl, setServerUrl } from '../lib/api';
import { useBranding } from '../store/branding';
import { cleanIpcError, formatDate } from '../lib/cx';
import { isSoundEnabled, setSoundEnabled } from '../lib/sounds.js';

const MAX_LOGO_BYTES = 8 * 1024 * 1024;

export function Settings() {
  const toast = useToast();
  const [server, setServer] = useState(getServerUrl());
  // Comes from the server itself: a machine cannot see which of its own
  // addresses the rest of the network can reach.
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const logoUrl = useBranding((s) => s.logoUrl);
  const refreshLogo = useBranding((s) => s.refresh);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmDeleteLogo, setConfirmDeleteLogo] = useState(false);

  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [savingPharmacy, setSavingPharmacy] = useState(false);

  const [printerPath, setPrinterPath] = useState('');
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [testing, setTesting] = useState(false);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);

  const [license, setLicense] = useState<LicenseCheck | null>(null);
  const [soundsOn, setSoundsOn] = useState(() => isSoundEnabled());

  function toggleSounds(enabled: boolean) {
    setSoundsOn(enabled);
    setSoundEnabled(enabled);
  }

  useEffect(() => {
    window.pharmacy
      .getSettings()
      .then((s) => {
        setPrinterPath(s.printerPath ?? '');
        setPharmacyName(s.pharmacyName ?? '');
        setPharmacyAddress(s.pharmacyAddress ?? '');
        setPharmacyPhone(s.pharmacyPhone ?? '');
      })
      .catch((err) => toast.error('تعذّر تحميل الإعدادات', cleanIpcError((err as Error).message)));
    api.backups().then(setBackups).catch(() => setBackups([]));
    api
      .health()
      .then((h) => setLanUrl(h.lanUrl ?? null))
      .catch(() => setLanUrl(null));
    // App.tsx already gated the whole app on this being valid to get here —
    // this call is purely to display who it's licensed to, not to re-decide access.
    window.pharmacy
      .getLicenseStatus()
      .then(setLicense)
      .catch((err) => toast.error('تعذّر تحميل حالة الترخيص', cleanIpcError((err as Error).message)));
  }, []);

  function saveServer() {
    setServerUrl(server);
    toast.success('تم حفظ عنوان الخادم');
  }

  async function pickLogo(file: File) {
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
    } catch (err) {
      toast.error('تعذّر رفع الشعار', (err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    setConfirmDeleteLogo(false);
    try {
      await api.deleteLogo();
      await refreshLogo();
      toast.success('تم حذف الشعار', undefined, { kind: 'delete' });
    } catch (err) {
      toast.error('تعذّر حذف الشعار', (err as Error).message);
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
    } catch (err) {
      toast.error('تعذّر الحفظ', cleanIpcError((err as Error).message));
    } finally {
      setSavingPharmacy(false);
    }
  }

  async function savePrinter() {
    setSavingPrinter(true);
    try {
      await window.pharmacy.setSettings({ printerPath: printerPath.trim() || null });
      toast.success('تم حفظ منفذ الطابعة');
    } catch (err) {
      toast.error('تعذّر الحفظ', cleanIpcError((err as Error).message));
    } finally {
      setSavingPrinter(false);
    }
  }

  async function downloadBackup(name: string) {
    setDownloadingBackup(name);
    try {
      await api.downloadBackup(name);
    } catch (err) {
      toast.error('تعذّر تنزيل النسخة الاحتياطية', cleanIpcError((err as Error).message));
    } finally {
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
    } catch (err) {
      toast.error('تعذّر الطباعة', cleanIpcError((err as Error).message));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <h2 className={styles.title}>
          <Building2 size={18} />
          بيانات الصيدلية
        </h2>
        <p className={styles.hint}>تُطبع في رأس كل إيصال — إعداد خاص بهذا الجهاز، لا يُشارَك مع الخادم.</p>

        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {logoUrl ? <img src={logoUrl} alt="شعار الصيدلية" /> : <span className={styles.logoPlaceholder}>لا يوجد شعار</span>}
          </div>
          <div className={styles.logoActions}>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingLogo}
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload size={14} />
              {uploadingLogo ? 'جارٍ الرفع…' : 'رفع شعار'}
            </Button>
            {logoUrl && (
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteLogo(true)}>
                <Trash2 size={14} />
                حذف الشعار
              </Button>
            )}
          </div>
          <p className={styles.hint}>يُرفَع مرة واحدة ويظهر تلقائياً في كل أجهزة الصيدلية على الشبكة وعلى الفواتير المطبوعة.</p>
        </div>

        <Input
          label="اسم الصيدلية"
          value={pharmacyName}
          onChange={(e) => setPharmacyName(e.target.value)}
          placeholder="صيدلية الشفاء"
        />
        <Input
          label="العنوان"
          value={pharmacyAddress}
          onChange={(e) => setPharmacyAddress(e.target.value)}
        />
        <Input
          label="الهاتف"
          value={pharmacyPhone}
          onChange={(e) => setPharmacyPhone(e.target.value)}
          dir="ltr"
        />
        <Button onClick={savePharmacyInfo} disabled={savingPharmacy}>
          <Save size={16} />
          {savingPharmacy ? 'جارٍ الحفظ…' : 'حفظ'}
        </Button>
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>
          <Server size={18} />
          عنوان الخادم
        </h2>
        <div className={styles.row}>
          <Input value={server} onChange={(e) => setServer(e.target.value)} dir="ltr" />
          <Button onClick={saveServer}>
            <Save size={16} />
            حفظ
          </Button>
        </div>
        {lanUrl && (
          <>
            <p className={styles.hint}>
              لربط جهاز كاشير آخر بهذا الجهاز، اكتب عنده هذا العنوان:{' '}
              <strong dir="ltr">{lanUrl}</strong>
            </p>
            <p className={styles.hint}>
              إذا تعذّر على جهاز آخر الاتصال بهذا العنوان، تأكد من السماح لهذا التطبيق عبر جدار حماية
              ويندوز (لوحة التحكم ← جدار حماية Windows Defender ← السماح لتطبيق عبر جدار الحماية).
            </p>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>
          <Printer size={18} />
          الطابعة الحرارية
        </h2>
        <div className={styles.row}>
          <Input
            value={printerPath}
            onChange={(e) => setPrinterPath(e.target.value)}
            dir="ltr"
            placeholder="مثال: USB أو /dev/usb/lp0"
            hint="منفذ الطابعة الحرارية المتصلة بجهاز الكاشير"
          />
          <Button onClick={savePrinter} disabled={savingPrinter}>
            <Save size={16} />
            حفظ
          </Button>
        </div>
        <Button variant="outline" onClick={testPrint} disabled={testing}>
          {testing ? 'جارٍ الطباعة…' : 'طباعة تجريبية'}
        </Button>
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>
          <Volume2 size={18} />
          الأصوات
        </h2>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={soundsOn}
            onChange={(e) => toggleSounds(e.target.checked)}
          />
          تفعيل أصوات التنبيه (إتمام بيع، حفظ، حذف)
        </label>
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>آخر النسخ الاحتياطية</h2>
        {backups.length === 0 ? (
          <p className={styles.empty}>لا توجد نسخ احتياطية بعد</p>
        ) : (
          <ul className={styles.backupList}>
            {backups.slice(0, 10).map((b) => (
              <li key={b.name}>
                <span>{formatDate(b.createdAt)}</span>
                <span className="numeric">{Math.round(b.sizeBytes / 1024)} كيلوبايت</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadBackup(b.name)}
                  disabled={downloadingBackup === b.name}
                  aria-label="تنزيل هذه النسخة"
                >
                  <Download size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>الاستعادة تتم من جهاز الخادم فقط عبر سطر الأوامر — راجع دليل التشغيل.</p>
      </section>

      {license?.valid && (
        <section className={styles.card}>
          <h2 className={styles.title}>
            <ShieldCheck size={18} />
            الترخيص
          </h2>
          <p className={styles.hint}>
            مرخَّص لـ: <strong>{license.payload.licensedTo}</strong>
            {' — '}
            {license.payload.expiresAt
              ? `صالح حتى ${formatDate(license.payload.expiresAt)}`
              : 'ترخيص دائم'}
          </p>
        </section>
      )}

      <ConfirmDialog
        open={confirmDeleteLogo}
        onOpenChange={setConfirmDeleteLogo}
        title="حذف الشعار؟"
        description="سيعود التطبيق للأيقونة الافتراضية في كل الأجهزة وعلى الفواتير المطبوعة، حتى يُرفَع شعار جديد."
        confirmLabel="حذف"
        onConfirm={removeLogo}
      />
    </div>
  );
}
