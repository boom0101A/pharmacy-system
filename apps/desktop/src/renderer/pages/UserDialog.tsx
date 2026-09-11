import { useEffect, useState, type FormEvent } from 'react';
import type { Role, User } from '@pharmacy/shared-types';
import styles from '../styles/dataPage.module.css';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null means "create a new user". */
  user: User | null;
  onSaved: () => void;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'مدير',
  pharmacist: 'صيدلي',
  cashier: 'كاشير',
};

const EMPTY = { name: '', username: '', password: '', role: 'cashier' as Role, isActive: true };

export function UserDialog({ open, onOpenChange, user, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? { name: user.name, username: user.username, password: '', role: user.role, isActive: user.isActive }
        : EMPTY,
    );
  }, [open, user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const name = form.name.trim();
    const username = form.username.trim();
    if (!name) return toast.error('الاسم مطلوب');
    if (!username) return toast.error('اسم المستخدم مطلوب');
    // A blank password is fine when editing (keeps the current one) but not on create.
    if (!user && form.password.trim().length < 4) {
      return toast.error('كلمة المرور قصيرة جداً', 'أربعة أحرف على الأقل');
    }
    if (user && form.password && form.password.trim().length < 4) {
      return toast.error('كلمة المرور قصيرة جداً', 'أربعة أحرف على الأقل');
    }

    setSaving(true);
    try {
      const password = form.password.trim();

      if (user) {
        // Omitting password entirely (not sending an empty string) is what
        // tells the server to keep the current one.
        await api.updateUser(user.id, {
          name,
          username,
          role: form.role,
          isActive: form.isActive,
          ...(password ? { password } : {}),
        });
        toast.success('تم تحديث المستخدم');
      } else {
        await api.createUser({ name, username, role: form.role, password });
        toast.success('تمت إضافة المستخدم');
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error('تعذّر الحفظ', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={user ? 'تعديل مستخدم' : 'مستخدم جديد'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button form="user-form" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </>
      }
    >
      <form id="user-form" className={styles.formGrid} onSubmit={handleSubmit}>
        <Input
          label="الاسم"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          autoFocus
        />
        <Input
          label="اسم المستخدم"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          dir="ltr"
          required
          disabled={user !== null}
          hint={
            user
              ? 'لا يمكن تغيير اسم المستخدم بعد الإنشاء'
              : 'هذا ما يُكتب عند تسجيل الدخول'
          }
        />

        <Input
          label="كلمة المرور"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          dir="ltr"
          hint={user ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : undefined}
        />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="user-role">
            الدور
          </label>
          <select
            id="user-role"
            className={styles.select}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          >
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {user && (
          <div className={styles.formGridFull}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              حساب نشط (يمكنه تسجيل الدخول)
            </label>
          </div>
        )}
      </form>
    </Dialog>
  );
}
