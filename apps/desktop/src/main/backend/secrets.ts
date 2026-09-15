import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';

export interface BackendSecrets {
  /** Signs login tokens. config.ts rejects anything under 32 characters. */
  jwtSecret: string;
  /** The password of the bundled database's only role. */
  dbPassword: string;
}

/**
 * Per-installation secrets, generated once on first launch and kept in the
 * user's data folder. They are deliberately *not* baked into the installer:
 * every pharmacy that installs this gets its own, so one leaked build can
 * never be used to forge an admin token on someone else's till.
 */
export function loadOrCreateSecrets(dir: string): BackendSecrets {
  const file = path.join(dir, 'secrets.json');

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return createAndSaveSecrets(dir, file);
    }
    // Anything other than "doesn't exist yet" (permissions, a read error) is
    // not safe to paper over: generating a fresh random password here, once
    // the database cluster already exists with the *real* one, means every
    // future connection fails authentication forever, silently, with no clue
    // in any log about why.
    throw new Error(`تعذّرت قراءة ملف الأسرار (${file}): ${(err as Error).message}`, { cause: err });
  }

  let existing: Partial<BackendSecrets>;
  try {
    existing = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `ملف الأسرار تالف (${file}) — لا يمكن المتابعة بأمان دون المخاطرة بقفل قاعدة البيانات`,
      { cause: err },
    );
  }
  if (!existing.jwtSecret || !existing.dbPassword) {
    throw new Error(`ملف الأسرار غير مكتمل (${file}) — لا يمكن المتابعة بأمان`);
  }
  return { jwtSecret: existing.jwtSecret, dbPassword: existing.dbPassword };
}

function createAndSaveSecrets(dir: string, file: string): BackendSecrets {
  const secrets: BackendSecrets = {
    jwtSecret: randomBytes(32).toString('hex'),
    dbPassword: randomBytes(16).toString('hex'),
  };
  fs.mkdirSync(dir, { recursive: true });
  writeFileAtomic(file, JSON.stringify(secrets, null, 2));
  return secrets;
}
