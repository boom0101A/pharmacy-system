import { Router } from 'express';
import multer from 'multer';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { requireCaptureToken } from '../middleware/auth.js';
import { saveProductImage } from '../services/productImage.service.js';

export const captureRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/** The phone-facing upload endpoint the capture page posts to — guarded by the scoped token, not a login. */
captureRouter.post(
  '/upload',
  requireCaptureToken,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'لم يُرفَع أي ملف');
    }
    const filename = await saveProductImage(req.captureProductId!, req.file.buffer);
    res.status(201).json({ imageFilename: filename });
  }),
);
