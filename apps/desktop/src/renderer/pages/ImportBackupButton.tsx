import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';

interface ImportBackupButtonProps {
  /** The stored backup's name — the caller offers to restore it. */
  onImported: (name: string) => void;
}

/** Moving to a new PC: the backup downloaded on the old one comes in here. */
export function ImportBackupButton({ onImported }: ImportBackupButtonProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { name } = await api.importBackup(file);
      onImported(name);
    } catch (err) {
      toast.error('تعذّر رفع النسخة', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        aria-label="ملف النسخة الاحتياطية"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again (after an error) still fires.
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload size={14} />
        {uploading ? 'جارٍ الرفع…' : 'رفع نسخة من ملف…'}
      </Button>
    </>
  );
}
