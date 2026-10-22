import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { getServerUrl } from '../lib/api';
import { cleanIpcError } from '../lib/cx';
import form from '../styles/dialogForm.module.css';

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: (username: string) => void;
}

/**
 * No email and no internet here, so ownership is proven with this machine's
 * own license key — the one thing only the pharmacy owner holds.
 */
export function ResetPasswordDialog({ open, onClose, onDone }: ResetPasswordDialogProps) {
  const [username, setUsername] = useState('admin');
  const [licenseKey, setLicenseKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (newPassword.length < 4) {
      setError('كلمة المرور قصيرة جداً — 4 أحرف على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await window.pharmacy.resetPassword({
        username: username.trim(),
        licenseKey: licenseKey.trim(),
        newPassword,
        serverUrl: getServerUrl(),
      });
      onDone(username.trim());
    } catch (err) {
      setError(cleanIpcError((err as Error).message) || 'تعذّرت إعادة تعيين كلمة المرور');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="إعادة تعيين كلمة المرور"
      description="أدخل مفتاح ترخيص هذا الجهاز لإثبات أنك صاحب النظام. تتم العملية من الجهاز الرئيسي."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button form="reset-password-form" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'إعادة التعيين'}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} className={form.stack}>
        {error && (
          <div role="alert" className={form.alert}>
            {error}
          </div>
        )}
        <Input label="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <Input
          label="مفتاح الترخيص"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          dir="ltr"
          placeholder="الصق المفتاح هنا"
          required
        />
        <Input
          label="كلمة المرور الجديدة"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </form>
    </Dialog>
  );
}
