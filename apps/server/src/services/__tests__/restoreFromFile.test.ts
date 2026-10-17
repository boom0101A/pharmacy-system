import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { prisma } from '../../prisma.js';
import { writeBackup } from '../../backup.js';
import type { AddressInfo } from 'node:net';
import { restoreFromFile } from '../restore.service.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';

async function backupFiles() {
  return (await fs.readdir(config.backupDir)).filter((f) => f.startsWith('backup-') && f.endsWith('.json'));
}

describe('restoreFromFile', () => {
  let uploadsSrc: string;

  beforeEach(async () => {
    uploadsSrc = await fs.mkdtemp(path.join(os.tmpdir(), 'restore-uploads-'));
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'restore-backups-'));
    config.uploadsDir = uploadsSrc;
  });

  it('brings the database back to the backup and keeps a safety copy of what it replaced', async () => {
    await prisma.product.create({ data: { name: 'قبل', salePrice: '1', purchasePrice: '1' } });
    const backupPath = await writeBackup(uploadsSrc);
    await prisma.product.create({ data: { name: 'بعد', salePrice: '1', purchasePrice: '1' } });

    await restoreFromFile(path.basename(backupPath));

    expect((await prisma.product.findMany()).map((p) => p.name)).toEqual(['قبل']);
    expect(await backupFiles()).toHaveLength(2);
  });

  it('puts back the product photos saved alongside that backup', async () => {
    await fs.mkdir(path.join(uploadsSrc, 'products'), { recursive: true });
    await fs.writeFile(path.join(uploadsSrc, 'products', 'a.jpg'), 'photo');
    const backupPath = await writeBackup(uploadsSrc);
    await fs.rm(path.join(uploadsSrc, 'products', 'a.jpg'));

    await restoreFromFile(path.basename(backupPath));

    expect(await fs.readFile(path.join(uploadsSrc, 'products', 'a.jpg'), 'utf8')).toBe('photo');
  });

  it.each(['../secrets.json', 'notes.txt', 'backup-x.json.tmp'])('refuses the unsafe name %s', async (name) => {
    await expect(restoreFromFile(name)).rejects.toMatchObject({ status: 400 });
  });

  it('answers 404 for a backup that is not there', async () => {
    await expect(restoreFromFile('backup-2020-01-01T00-00-00.000Z.json')).rejects.toMatchObject({ status: 404 });
  });

  it('over HTTP: admin only, and only with the typed confirmation', async () => {
    const backupPath = await writeBackup(uploadsSrc);
    const name = path.basename(backupPath);
    const admin = await prisma.user.create({ data: { name: 'م', username: 'a', passwordHash: 'x', role: 'admin' } });
    const cashier = await prisma.user.create({ data: { name: 'ك', username: 'c', passwordHash: 'x', role: 'cashier' } });
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/backup/${name}/restore`;
    const post = (userId: number, role: 'admin' | 'cashier', body: object) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ userId, role })}` },
        body: JSON.stringify(body),
      });
    try {
      expect((await post(cashier.id, 'cashier', { confirm: 'RESTORE' })).status).toBe(403);
      expect((await post(admin.id, 'admin', {})).status).toBe(400);
      // The backup predates both accounts, so after restoring there are none.
      expect((await post(admin.id, 'admin', { confirm: 'RESTORE' })).status).toBe(204);
      expect(await prisma.user.count()).toBe(0);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('rejects a damaged file without touching the current data', async () => {
    await prisma.product.create({ data: { name: 'باقٍ', salePrice: '1', purchasePrice: '1' } });
    const name = 'backup-2020-01-01T00-00-00.000Z.json';
    await fs.writeFile(path.join(config.backupDir, name), '{"createdAt":"x","tables":{"users":[]}}');

    await expect(restoreFromFile(name)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.product.count()).toBe(1);
  });
});
