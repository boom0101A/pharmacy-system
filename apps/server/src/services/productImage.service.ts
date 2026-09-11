import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../prisma.js';

function uploadDir() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads', 'products');
}

/** Resizes/re-encodes whatever the phone or the desktop sends into one predictable JPEG so the catalogue grid never has to lay out wildly different image shapes. */
export async function saveProductImage(productId: number, buffer: Buffer): Promise<string> {
  await fs.mkdir(uploadDir(), { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const resized = await sharp(buffer)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  await fs.writeFile(path.join(uploadDir(), filename), resized);

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { imageFilename: true },
  });
  await prisma.product.update({ where: { id: productId }, data: { imageFilename: filename } });

  // Best-effort cleanup of whatever this photo replaces.
  if (existing?.imageFilename) {
    await fs.unlink(path.join(uploadDir(), existing.imageFilename)).catch(() => {});
  }

  return filename;
}
