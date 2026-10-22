import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import form from '../styles/dialogForm.module.css';

interface RestoreBackupDialogProps {
  /** The backup to restore; the dialog is open while this is set. */
  name: string | null;
  onClose: () => void;
  onRestored: () => void;
}

/**
 * Wipes every till's data, so a single click is not enough — the same typed
 * RESTORE the command-line tool has always asked for.
 */
export function RestoreBackupDialog({ name, onClose, onRestored }: RestoreBackupDialogProps) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  function close() {
    if (restoring) return;
    setConfirm('');
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name || confirm !== 'RESTORE') return;

    setRestoring(true);
    setError(null);
    try {
      await api.restoreBackup(name);
      onRestored();
    } catch (err) {
      setError((err as Error).message || 'تعذّرت الاستعادة');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog
      open={name !== null}
      onOpenChange={(open) => !open && close()}
      title="استعادة نسخة احتياطية"
      description="سيُستبدل كل ما في قاعدة البيانات الآن (مبيعات، مخزون، مستخدمون) بمحتوى هذه النسخة، على كل الأجهزة. تُحفظ نسخة من الوضع الحالي تلقائياً قبل الاستعادة."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={close} disabled={restoring}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            form="restore-backup-form"
            type="submit"
            disabled={restoring || confirm !== 'RESTORE'}
          >
            {restoring ? 'جارٍ الاستعادة…' : 'استعادة'}
          </Button>
        </>
      }
    >
      <form id="restore-backup-form" onSubmit={handleSubmit} className={form.stack}>
        {error && (
          <div role="alert" className={form.alert}>
            {error}
          </div>
        )}
        <Input
          label="للتأكيد اكتب RESTORE"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          dir="ltr"
          autoComplete="off"
          autoFocus
        />
      </form>
    </Dialog>
  );
}
