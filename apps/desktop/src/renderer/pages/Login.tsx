import { useState, type FormEvent } from 'react';
import { Cross } from 'lucide-react';
import styles from './Login.module.css';
import { AuthHero } from '../components/AuthHero';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../store/auth';
import { useBranding } from '../store/branding';
import { getServerUrl, setServerUrl } from '../lib/api';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export function Login() {
  const { login, loading, error } = useAuth();
  const logoUrl = useBranding((s) => s.logoUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(getServerUrl());
  const [showServerField, setShowServerField] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // The address is saved before the attempt so a retry uses the new value.
    setServerUrl(server);
    setResetNotice(null);
    await login(username, password);
  }

  return (
    <div className={styles.page}>
      <AuthHero />
      <div className={styles.card}>
        <div className={styles.brand}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className={styles.logo} />
          ) : (
            <span className={styles.mark}>
              <Cross size={26} />
            </span>
          )}
          <div>
            <h1 className={styles.title}>نظام الصيدلية</h1>
            <p className={styles.subtitle}>سجّل الدخول للمتابعة</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {resetNotice ? (
            <div className={styles.notice}>{resetNotice}</div>
          ) : (
            error && <div className={styles.alert}>{error}</div>
          )}

          <Input
            label="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <Button type="submit" size="lg" fullWidth disabled={loading}>
            {loading ? 'جارٍ الدخول…' : 'دخول'}
          </Button>

          <button type="button" className={styles.serverToggle} onClick={() => setResetOpen(true)}>
            نسيت كلمة المرور؟
          </button>

          {showServerField ? (
            <div className={styles.serverRow}>
              <Input
                label="عنوان الخادم"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                hint="عنوان الجهاز الذي يشغّل الخادم على الشبكة المحلية"
                dir="ltr"
                autoFocus
              />
            </div>
          ) : (
            <button
              type="button"
              className={styles.serverToggle}
              onClick={() => setShowServerField(true)}
            >
              تغيير عنوان الخادم
            </button>
          )}
        </form>
      </div>

      <ResetPasswordDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onDone={(name) => {
          setResetOpen(false);
          setUsername(name);
          setPassword('');
          setResetNotice('تم تغيير كلمة المرور — سجّل الدخول بالكلمة الجديدة');
        }}
      />
    </div>
  );
}
