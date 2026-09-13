import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, ShieldCheck, Upload } from 'lucide-react';
import styles from './Activation.module.css';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface ActivationProps {
  onActivated: () => void;
}

/**
 * Shown instead of the login screen whenever `window.pharmacy.getLicenseStatus`
 * comes back invalid — no key stored yet, a key for a different machine, a
 * tampered key, or an expired one. The machine ID here is what the developer
 * needs to actually issue a key (see scripts/generate-license.mjs).
 */
export function Activation({ onActivated }: ActivationProps) {
  const [machineId, setMachineId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.pharmacy
      .getMachineId()
      .then(setMachineId)
      .catch((err: Error) => setError(err.message || 'تعذّر قراءة معرّف الجهاز'));
  }, []);

  async function copyMachineId() {
    if (!machineId) return;
    await navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function pickKeyFile(file: File) {
    setKey((await file.text()).trim());
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setActivating(true);
    setError(null);
    try {
      const result = await window.pharmacy.activateLicense(key.trim());
      if (result.valid) {
        onActivated();
      } else {
        setError(result.error);
      }
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <ShieldCheck size={26} />
          </span>
          <div>
            <h1 className={styles.title}>تفعيل النظام</h1>
            <p className={styles.subtitle}>هذا الجهاز يحتاج مفتاح ترخيص قبل أول استخدام</p>
          </div>
        </div>

        <div className={styles.machineBlock}>
          <span className={styles.machineLabel}>رمز هذا الجهاز — أرسله لمن زوّدك بالنظام</span>
          <div className={styles.machineRow}>
            <code className={styles.machineId}>{machineId ?? '...'}</code>
            <Button type="button" variant="outline" size="sm" onClick={copyMachineId} disabled={!machineId}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'نُسخ' : 'نسخ'}
            </Button>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.alert}>{error}</div>}

          <Input
            label="مفتاح الترخيص"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(null);
            }}
            dir="ltr"
            placeholder="الصق المفتاح هنا"
            autoFocus
            required
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.lic"
            hidden
            onChange={(e) => e.target.files?.[0] && pickKeyFile(e.target.files[0])}
          />
          <button type="button" className={styles.fileToggle} onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} />
            أو اختر ملف الترخيص
          </button>

          <Button type="submit" size="lg" fullWidth disabled={activating || !key.trim()}>
            {activating ? 'جارٍ التحقق…' : 'تفعيل'}
          </Button>
        </form>
      </div>
    </div>
  );
}
