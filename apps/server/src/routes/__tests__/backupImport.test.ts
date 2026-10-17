import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { prisma } from '../../prisma.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { writeBackup } from '../../backup.js';
import { restoreFromFile } from '../../services/restore.service.js';

let server: Server;
let base: string;

beforeEach(async () => {
  config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-backups-'));
  config.uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-uploads-'));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/backup`;
});

afterEach(() => new Promise<void>((r) => server.close(() => r())));

async function tokenFor(role: 'admin' | 'cashier') {
  const user = await prisma.user.create({ data: { name: 'م', username: `${role}-${Math.random()}`, passwordHash: 'x', role } });
  return signToken({ userId: user.id, role });
}

function upload(token: string, content: string, filename = 'my-backup.json') {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/json' }), filename);
  return fetch(`${base}/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
}

async function jsonFiles() {
  return (await fs.readdir(config.backupDir)).filter((f) => f.endsWith('.json'));
}

describe('uploading a backup file from another machine', () => {
  it('stores it as a restorable backup without changing any data yet', async () => {
    // A backup taken on the "old machine": one product.
    await prisma.product.create({ data: { name: 'من الجهاز القديم', salePrice: '1', purchasePrice: '1' } });
    const content = await fs.readFile(await writeBackup(), 'utf8');
    await fs.rm(config.backupDir, { recursive: true, force: true });
    await fs.mkdir(config.backupDir);
    await prisma.product.deleteMany();
    const token = await tokenFor('admin');

    const res = await upload(token, content);

    expect(res.status).toBe(201);
    const { name } = (await res.json()) as { name: string };
    expect(name).toMatch(/^backup-.+\.json$/);
    expect(await jsonFiles()).toEqual([name]);
    expect(await prisma.product.count()).toBe(0);

    await restoreFromFile(name);
    expect((await prisma.product.findMany()).map((p) => p.name)).toEqual(['من الجهاز القديم']);
  });

  it('accepts a backup from an older version that lacks newer tables', async () => {
    const token = await tokenFor('admin');
    const old = {
      createdAt: '2026-09-01T00:00:00.000Z',
      tables: Object.fromEntries(
        ['users', 'categories', 'products', 'batches', 'suppliers', 'purchases', 'purchaseItems', 'sales', 'saleItems', 'returns', 'returnItems'].map((t) => [t, []]),
      ),
    };

    expect((await upload(token, JSON.stringify(old))).status).toBe(201);
  });

  it.each([
    ['not JSON at all', 'hello'],
    ['JSON that is not a backup', '{"a":1}'],
  ])('rejects %s with an Arabic reason and writes nothing', async (_label, content) => {
    const token = await tokenFor('admin');

    const res = await upload(token, content);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('نسخة احتياطية');
    expect(await jsonFiles()).toEqual([]);
  });

  it('is for the admin only', async () => {
    expect((await upload(await tokenFor('cashier'), '{}')).status).toBe(403);
  });
});
