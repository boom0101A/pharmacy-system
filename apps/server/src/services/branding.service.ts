import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

function brandingDir() {
  return path.join(config.uploadsDir, 'pharmacy');
}

function logoPath() {
  return path.join(brandingDir(), 'logo.png');
}

/** One fixed filename, always overwritten — there is only ever one pharmacy, so no id/lookup is needed. */
export async function saveLogo(buffer: Buffer): Promise<void> {
  await fs.mkdir(brandingDir(), { recursive: true });
  const resized = await sharp(buffer)
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  await fs.writeFile(logoPath(), resized);
}

export async function deleteLogo(): Promise<void> {
  await fs.unlink(logoPath()).catch(() => {});
}

/** `updatedAt` doubles as a cache-busting version: till machines and browsers both use it to know when their cached copy is stale. */
export async function getLogoInfo(): Promise<{ hasLogo: boolean; updatedAt: string | null }> {
  try {
    const stat = await fs.stat(logoPath());
    return { hasLogo: true, updatedAt: stat.mtime.toISOString() };
  } catch {
    return { hasLogo: false, updatedAt: null };
  }
}
