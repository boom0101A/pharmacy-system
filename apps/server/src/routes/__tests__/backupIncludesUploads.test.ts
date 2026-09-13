import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { writeBackup } from '../../backup.js';

describe('writeBackup', () => {
  let uploadsSrc: string;

  beforeEach(async () => {
    uploadsSrc = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-src-'));
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-dest-'));
  });

  it('backs up the uploads directory alongside the database dump, not just the database', async () => {
    await fs.mkdir(path.join(uploadsSrc, 'pharmacy'), { recursive: true });
    await fs.writeFile(path.join(uploadsSrc, 'pharmacy', 'logo.png'), 'fake-logo-bytes');

    await writeBackup(uploadsSrc);

    const entries = await fs.readdir(config.backupDir);
    const uploadsBackupDir = entries.find((e) => e.startsWith('uploads-'));
    expect(uploadsBackupDir).toBeDefined();

    const copied = await fs.readFile(
      path.join(config.backupDir, uploadsBackupDir!, 'pharmacy', 'logo.png'),
      'utf8',
    );
    expect(copied).toBe('fake-logo-bytes');

    // The database dump itself must still be there too — this is additive.
    const dbBackupFile = entries.find((e) => e.startsWith('backup-') && e.endsWith('.json'));
    expect(dbBackupFile).toBeDefined();
  });
});
