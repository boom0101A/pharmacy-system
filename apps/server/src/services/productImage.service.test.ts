import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

describe('saveProductImage rejects before writing when the product does not exist', () => {
  it('leaves no orphaned file on disk when the product id does not exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-img-'));

    await withUploadsDir(dir, async () => {
      const { saveProductImage } = await import('./productImage.service.js');
      await expect(saveProductImage(999_999_999, PNG_1X1)).rejects.toThrow();
    });

    const productsDir = path.join(dir, 'products');
    const filesLeftBehind = await fs.readdir(productsDir).catch(() => []);
    expect(filesLeftBehind).toEqual([]);
  });
});
