import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import type { Role, User } from '@pharmacy/shared-types';
import styles from '../styles/dataPage.module.css';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { UserDialog } from './UserDialog';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'مدير',
  pharmacist: 'صيدلي',
  cashier: 'كاشير',
};

const ROLE_TONE: Record<Role, 'info' | 'success' | 'neutral'> = {
  admin: 'info',
  pharmacist: 'success',
  cashier: 'neutral',
};

export function Users() {
  const toast = useToast();
  const currentUserId = useAuth((s) => s.user?.id);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api.users());
    } catch (err) {
      toast.error('تعذّر تحميل المستخدمين', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(user: User) {
    try {
      await api.deleteUser(user.id);
      toast.success('تم حذف المستخدم');
      load();
    } catch (err) {
      // A user with prior sales/purchases can't be deleted (server enforces this).
      toast.error('تعذّر الحذف', (err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.spacer}>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} />
            مستخدم جديد
          </Button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <table className={styles.table}>
            <tbody>
              <SkeletonRows rows={3} columns={5} />
            </tbody>
          </table>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={26} />}
            title="لا يوجد مستخدمون بعد"
            description="أنشئ حسابات للصيادلة والكاشيرين لتحديد صلاحية كل واحد منهم."
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td className={styles.name}>
                      {u.name}
                      {isSelf && <Badge tone="neutral"> أنت</Badge>}
                    </td>
                    <td className={styles.numericCell}>{u.username}</td>
                    <td>
                      <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                    </td>
                    <td>
                      <Badge tone={u.isActive ? 'success' : 'danger'}>
                        {u.isActive ? 'نشط' : 'معطّل'}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(u);
                            setDialogOpen(true);
                          }}
                          aria-label={`تعديل ${u.name}`}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(u)}
                          disabled={isSelf}
                          aria-label={`حذف ${u.name}`}
                          title={isSelf ? 'لا يمكنك حذف حسابك الخاص' : undefined}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} onSaved={load} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف "${deleting?.name}"؟`}
        description="لا يمكن التراجع عن هذا الإجراء."
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  );
}
