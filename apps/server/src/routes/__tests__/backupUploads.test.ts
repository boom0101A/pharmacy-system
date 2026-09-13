import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { backupUploads } from '../../backup.js';

describe('backupUploads', () => {
  let uploadsSrc: string;

  beforeEach(async () => {
    uploadsSrc = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-src-'));
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-dest-'));
  });

  it('copies uploaded files into the backup directory, mirroring the DB backup that already happens', async () => {
    await fs.mkdir(path.join(uploadsSrc, 'products'), { recursive: true });
    await fs.writeFile(path.join(uploadsSrc, 'products', 'abc.jpg'), 'fake-image-bytes');

    const dest = await backupUploads(uploadsSrc);

    expect(dest).not.toBeNull();
    const copied = await fs.readFile(path.join(dest!, 'products', 'abc.jpg'), 'utf8');
    expect(copied).toBe('fake-image-bytes');
  });

  it('returns null without throwing when there is no uploads directory yet (fresh install)', async () => {
    const missingDir = path.join(uploadsSrc, 'does-not-exist');
    const dest = await backupUploads(missingDir);
    expect(dest).toBeNull();
  });
});
