import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import multer from 'multer';
import { parseBackup, restoreFromFile } from '../services/restore.service.js';
import { backupFilename } from '../backup.js';
import { broadcastStockChanged } from '../sockets/stock.js';
import { prisma } from '../prisma.js';

const restoreSchema = z.object({
  confirm: z.literal('RESTORE', { errorMap: () => ({ message: 'اكتب RESTORE لتأكيد الاستعادة' }) }),
});

export const backupRouter = Router();
backupRouter.use(requireAuth);
backupRouter.use(checkRole('admin'));

backupRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const files = await fs.readdir(config.backupDir).catch(() => [] as string[]);
    const rows = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (name) => {
          const stat = await fs.stat(path.join(config.backupDir, name));
          return { name, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
        }),
    );
    res.json(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),
);

backupRouter.get(
  '/:name',
  asyncHandler(async (req, res) => {
    const name = req.params.name;
    if (!/^[\w.-]+\.json$/.test(name)) {
      throw new AppError(400, 'اسم ملف غير صالح');
    }
    const file = path.join(config.backupDir, name);
    try {
      await fs.access(file);
    } catch {
      throw new AppError(404, 'الملف غير موجود');
    }
    res.download(file);
  }),
);

// A year of sales is a few MB of JSON; this leaves ample room without letting a stray huge file in.
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/**
 * Brings a downloaded backup onto this machine (a new PC, a reinstalled
 * Windows). Only stores it next to the local backups — restoring it is still
 * the separate, confirmed step below.
 */
backupRouter.post(
  '/import',
  importUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'اختر ملف النسخة الاحتياطية');
    try {
      parseBackup(req.file.buffer.toString('utf8'));
    } catch {
      throw new AppError(400, 'الملف ليس نسخة احتياطية صالحة من هذا النظام');
    }

    await fs.mkdir(config.backupDir, { recursive: true });
    // "-imported" keeps it out of hasRecentBackup(): another machine's data
    // must never stand in for today's backup of this one.
    const name = backupFilename(new Date()).replace(/\.json$/, '-imported.json');
    const file = path.join(config.backupDir, name);
    await fs.writeFile(`${file}.tmp`, req.file.buffer);
    await fs.rename(`${file}.tmp`, file);
    res.status(201).json({ name });
  }),
);

backupRouter.post(
  '/:name/restore',
  asyncHandler(async (req, res) => {
    restoreSchema.parse(req.body);
    await restoreFromFile(req.params.name);
    // Every till is still showing stock from before the restore.
    const products = await prisma.product.findMany({ select: { id: true } });
    broadcastStockChanged(products.map((p) => p.id));
    res.status(204).end();
  }),
);
