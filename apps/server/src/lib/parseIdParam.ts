import { AppError } from '../middleware/errors.js';

/**
 * `Number(req.params.id)` alone turns "/api/products/abc" into `NaN`, which
 * Prisma then rejects with its own internal validation error — an opaque
 * 500 instead of a clear 400 naming the actual problem.
 */
export function parseIdParam(raw: string | undefined, label = 'المعرّف'): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `${label} غير صالح`);
  }
  return id;
}
