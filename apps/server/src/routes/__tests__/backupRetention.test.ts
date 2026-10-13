import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { hasRecentBackup, writeBackup } from '../../backup.js';

describe('backup retention', () => {
  let uploadsSrc: string;

  beforeEach(async () => {
    uploadsSrc = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-src-'));
    await fs.writeFile(path.join(uploadsSrc, 'logo.png'), 'x');
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-ret-'));
  });

  it('prunes old uploads-* copies with the same retention as the JSON backups', async () => {
    for (let i = 0; i < config.backupRetention + 3; i++) {
      await fs.mkdir(path.join(config.backupDir, `uploads-2020-01-${String(i + 1).padStart(2, '0')}T00-00-00.000Z`));
    }

    await writeBackup(uploadsSrc);

    const copies = (await fs.readdir(config.backupDir)).filter((f) => f.startsWith('uploads-'));
    expect(copies.length).toBe(config.backupRetention);
  });

  it('leaves no temp file behind and writes a complete JSON backup', async () => {
    const file = await writeBackup(uploadsSrc);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).tables).toBeDefined();
    expect((await fs.readdir(config.backupDir)).some((f) => f.endsWith('.tmp'))).toBe(false);
  });
});

describe('hasRecentBackup', () => {
  beforeEach(async () => {
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-recent-'));
  });

  it('is true when a backup newer than 24 hours exists, so restarting the till does not churn history', async () => {
    const now = new Date('2026-10-12T12:00:00.000Z');
    await fs.writeFile(path.join(config.backupDir, 'backup-2026-10-12T02-00-00.000Z.json'), '{}');
    expect(await hasRecentBackup(now)).toBe(true);
  });

  it('is false when the newest backup is older than 24 hours', async () => {
    const now = new Date('2026-10-12T12:00:00.000Z');
    await fs.writeFile(path.join(config.backupDir, 'backup-2026-10-10T02-00-00.000Z.json'), '{}');
    expect(await hasRecentBackup(now)).toBe(false);
  });

  it('is false when there are no backups at all', async () => {
    expect(await hasRecentBackup(new Date())).toBe(false);
  });
});
