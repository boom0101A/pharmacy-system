import 'dotenv/config';

const DEFAULT_JWT_SECRET_PLACEHOLDER = 'change-me-change-me-change-me-change-me';

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
};
