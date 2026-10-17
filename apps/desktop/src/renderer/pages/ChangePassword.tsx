import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import styles from './Login.module.css';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

/**
 * Shown instead of the whole app while the signed-in user is still on a
 * password someone else picked — admin/admin123 is printed in the manual.
 */
export function ChangePassword() {
  const user = useAuth((s) => s.user);
  const passwordChanged = useAuth((s) => s.passwordChanged);
  const logout = useAuth((s) => s.logout);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (next.length < 4) {
      setError('كلمة المرور قصيرة جداً — 4 أحرف على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      passwordChanged();
    } catch (err) {
      setError((err as Error).message || 'تعذّر تغيير كلمة المرور');
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <KeyRound size={26} />
          </span>
          <div>
            <h1 className={styles.title}>غيّر كلمة المرور</h1>
            <p className={styles.subtitle}>
              {user?.name ? `${user.name}، ` : ''}اختر كلمة مرور خاصة بك قبل المتابعة
            </p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <div className={styles.alert} role="alert">
              {error}
            </div>
          )}
          <Input
            label="كلمة المرور الحالية"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
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
          <Button type="submit" size="lg" fullWidth disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
          </Button>
          <button type="button" className={styles.serverToggle} onClick={logout}>
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );
}
