import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma.js';

/**
 * The packaged app installs into Program Files, which is read-only, so every
 * folder the server writes to has to be redirectable. These cover the
 * *default* (no-argument) paths — the ones an installed copy actually uses,
 * and the ones the existing backup tests never exercised because they always
 * pass an explicit directory.
 */
async function withUploadsDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  process.env.UPLOADS_DIR = dir;
  vi.resetModules();
  try {
    return await fn();
  } finally {
    delete process.env.UPLOADS_DIR;
    vi.resetModules();
  }
}

afterEach(() => {
  delete process.env.UPLOADS_DIR;
});

describe('uploads directory is redirectable', () => {
  it('saveProductImage writes the photo into UPLOADS_DIR', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-cfg-'));
    const product = await prisma.product.create({
      data: { name: 'دواء الصورة', salePrice: '10', purchasePrice: '5' },
    });
    // A 1x1 PNG — real bytes, so the real sharp pipeline runs.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const filename = await withUploadsDir(dir, async () => {
      const { saveProductImage } = await import('../productImage.service.js');
      return saveProductImage(product.id, png);
    });

    await expect(fs.stat(path.join(dir, 'products', filename))).resolves.toBeDefined();
  });

  it('backupUploads with no argument copies from UPLOADS_DIR', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-cfg-'));
    await fs.mkdir(path.join(dir, 'products'), { recursive: true });
    await fs.writeFile(path.join(dir, 'products', 'kept.jpg'), 'bytes');
    const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-cfg-'));

    const dest = await withUploadsDir(dir, async () => {
      const { config } = await import('../../config.js');
      config.backupDir = backupDir;
      const { backupUploads } = await import('../../backup.js');
      return backupUploads();
    });

    expect(dest).not.toBeNull();
    await expect(fs.stat(path.join(dest!, 'products', 'kept.jpg'))).resolves.toBeDefined();
  });
});
