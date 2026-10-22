import { useEffect, useState, type FormEvent } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { formatDate } from '../lib/cx';
import { licenseDaysLeft } from '../lib/licenseDays';
import form from '../styles/dialogForm.module.css';

interface LicenseRenewalProps {
  license: { valid: true; payload: LicensePayload };
  onChanged: (license: LicenseCheck) => void;
}

/**
 * Extending a trial or making it perpetual before it runs out. The new key is
 * still one the owner signed for this machine — the app cannot extend itself.
 */
export function LicenseRenewal({ license, onChanged }: LicenseRenewalProps) {
  const [machineId, setMachineId] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { licensedTo, expiresAt } = license.payload;
  const days = licenseDaysLeft(expiresAt);

  useEffect(() => {
    window.pharmacy.getMachineId().then(setMachineId).catch(() => setMachineId(null));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.pharmacy.replaceLicense(key.trim());
      if (!result.valid) {
        setError(result.error);
        return;
      }
      setKey('');
      setNotice(
        result.payload.expiresAt
          ? `تم التمديد حتى ${formatDate(result.payload.expiresAt)}`
          : 'تم التحويل إلى ترخيص دائم',
      );
      onChanged(result);
    } catch (err) {
      setError((err as Error).message || 'تعذّر تحديث الترخيص');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={form.stack}>
      <p className={form.text}>
        <ShieldCheck size={14} /> مرخَّص لـ: <strong>{licensedTo}</strong>
        {' — '}
        {expiresAt ? `صالح حتى ${formatDate(expiresAt)} (بعد ${days} يوم)` : 'ترخيص دائم'}
      </p>

      <div className={form.row}>
        <span>رمز الجهاز:</span>
        <code dir="ltr" className={form.code}>{machineId ?? '…'}</code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="نسخ رمز الجهاز"
          disabled={!machineId}
          onClick={() => machineId && void navigator.clipboard.writeText(machineId)}
        >
          <Copy size={14} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className={form.stackTight}>
        <Input
          label="مفتاح جديد (تمديد أو ترخيص دائم)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          dir="ltr"
          autoComplete="off"
          hint="أرسل رمز الجهاز لصاحب النظام ليُصدر لك مفتاحاً جديداً، ثم الصقه هنا"
          error={error ?? undefined}
        />
        {notice && (
          <div role="status" className={form.notice}>
            {notice}
          </div>
        )}
        <div>
          <Button type="submit" size="sm" disabled={saving || !key.trim()}>
            {saving ? 'جارٍ التحديث…' : 'تحديث الترخيص'}
          </Button>
        </div>
      </form>
    </div>
  );
}
