import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import multer from 'multer';
import { logger } from '../lib/logger.js';

/** A deliberate, expected failure carrying its own HTTP status and Arabic message. */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps an async route handler so a rejected promise reaches this error middleware instead of crashing the process. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'تعذّر رفع الملف — تحقق من الحجم والنوع' });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'بيانات غير صالحة', details: err.flatten() });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof PrismaClientKnownRequestError) {
    // P2003 fires both ways (deleting a row others still reference; inserting
    // one that points at a row that isn't there) — the message covers both,
    // since reading "cannot delete" after a failed insert sends you looking
    // in entirely the wrong place.
    if (err.code === 'P2003') {
      return res
        .status(409)
        .json({ error: 'تعذّرت العملية — العنصر مرتبط بسجلات أخرى أو يشير إلى سجل غير موجود' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'العنصر غير موجود' });
    }
    // P2002: a unique constraint collision (duplicate username, duplicate
    // product barcode, etc.) — an expected validation case, not a bug.
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'هذه القيمة مستخدمة بالفعل' });
    }
    // P2034: a concurrent transaction hit a write conflict/deadlock (e.g. two
    // sales locking the same product's batches in reversed order) — expected
    // under concurrency, not a bug; the client should just retry the sale.
    if (err.code === 'P2034') {
      return res.status(409).json({ error: 'تعارض مؤقت مع عملية أخرى — أعد محاولة البيع' });
    }
  }
  logger.error('Unhandled request error', err);
  return res.status(500).json({ error: 'خطأ في الخادم' });
}
