import { Router } from 'express';
import multer from 'multer';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { deleteLogo, getLogoInfo, saveLogo } from '../services/branding.service.js';

export const brandingRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/** Unauthenticated on purpose — the login screen shows the logo before anyone has signed in, and this reveals nothing sensitive. */
brandingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getLogoInfo());
  }),
);

brandingRouter.post(
  '/logo',
  requireAuth,
  checkRole('admin'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'لم يُرفَع أي ملف');
    }
    await saveLogo(req.file.buffer);
    res.status(201).json(await getLogoInfo());
  }),
);

brandingRouter.delete(
  '/logo',
  requireAuth,
  checkRole('admin'),
  asyncHandler(async (_req, res) => {
    await deleteLogo();
    res.status(204).send();
  }),
);
