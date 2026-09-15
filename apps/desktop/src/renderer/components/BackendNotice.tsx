import styles from './BackendNotice.module.css';

const STAGE_MESSAGES = {
  database: 'جارٍ تهيئة قاعدة البيانات لأول مرة… قد يستغرق هذا نصف دقيقة.',
  schema: 'جارٍ تجهيز جداول النظام…',
  server: 'جارٍ تشغيل الخادم…',
} as const;

/**
 * What to tell the user about the bundled backend. A first launch creates a
 * whole database cluster, which takes tens of seconds — without this the app
 * would just sit there claiming it cannot reach the server.
 */
export function bootstrapMessage(status: BackendStatus): string | null {
  switch (status.status) {
    case 'starting':
      return STAGE_MESSAGES[status.stage];
    case 'failed':
      return `تعذّر تشغيل الخادم المدمج: ${status.message}`;
    default:
      return null;
  }
}

export function BackendNotice({ status }: { status: BackendStatus }) {
  const message = bootstrapMessage(status);
  if (!message) return null;

  return (
    <div className={styles.notice} role="status" data-failed={status.status === 'failed' || undefined}>
      {status.status === 'starting' && <span className={styles.spinner} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}
