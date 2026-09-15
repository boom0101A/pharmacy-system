import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_JWT_SECRET_PLACEHOLDER = 'change-me-change-me-change-me-change-me';

/**
 * Resolved against this module, never the cwd: the packaged app spawns the
 * server as a child process from a different working directory, and these
 * folders must still land in the same place they do in development.
 */
function inRepo(folder: string): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', folder);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`متغيّر البيئة ${name} مطلوب — راجع apps/server/.env`);
  }
  return value;
}

const jwtSecret = process.env.JWT_SECRET ?? '';
// A weak or still-default secret means anyone who reads .env.example could
// forge a valid admin token — refuse to boot rather than run insecurely.
if (jwtSecret.length < 32 || jwtSecret === DEFAULT_JWT_SECRET_PLACEHOLDER) {
  throw new Error(
    'JWT_SECRET غير صالح — يجب أن يكون 32 حرفاً على الأقل ومختلفاً عن القيمة الافتراضية في .env.example',
  );
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  databaseUrl: required('DATABASE_URL'),
  backupDir: process.env.BACKUP_DIR ?? './backups',
  backupRetention: Number(process.env.BACKUP_RETENTION ?? 14),
  // Overridable so an installed copy can write under the user's data folder
  // instead of Program Files, which is read-only.
  uploadsDir: process.env.UPLOADS_DIR ?? inRepo('uploads'),
  logsDir: process.env.LOGS_DIR ?? inRepo('logs'),
  // Static assets shipped with the code (the phone capture page). Separate
  // from the writable folders above: this one is read-only, and bundling the
  // server into a single file moves it away from its original neighbours.
  publicDir: process.env.PUBLIC_DIR ?? inRepo('public'),
};
