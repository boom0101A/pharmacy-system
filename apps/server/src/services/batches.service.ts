import type { Batch } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/errors.js';

/**
 * Zeroes an expired batch's remaining quantity and logs the write-off — the
 * batch row itself is kept (unlike delete) so any SaleItem that already
 * points at it never dangles, and FEFO's ordering stays intact.
 */
export async function writeOffBatch(batchId: number, userId: number): Promise<Batch> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new AppError(404, 'الدفعة غير موجودة');
    }
    if (batch.quantity <= 0) {
      throw new AppError(409, 'رصيد هذه الدفعة صفر أصلاً — لا شيء لإتلافه');
    }

    // Raw CURRENT_DATE comparison, not a JS Date check — this must agree
    // exactly with sales.service.ts's FEFO exclusion query (which uses the
    // same expression) on what "already expired" means, including the
    // edge case of a batch expiring today (still sellable, not yet
    // write-off-eligible) and no timezone drift between Node and Postgres.
    const [{ expired }] = await tx.$queryRaw<{ expired: boolean }[]>`
      SELECT expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE AS expired
      FROM batches WHERE id = ${batchId}
    `;
    if (!expired) {
      throw new AppError(409, 'لا يمكن إتلاف دفعة لم تنتهِ صلاحيتها بعد');
    }

    await tx.batchWriteOff.create({
      data: { batchId: batch.id, quantity: batch.quantity, userId },
    });

    return tx.batch.update({ where: { id: batchId }, data: { quantity: 0 } });
  });
}

/**
 * A batch already drawn from by a sale can't be deleted outright: the
 * sale/return history points at it (sale_items.batch_id), and deleting it
 * would either break that foreign key or silently orphan the invoice's
 * cost/expiry trail. The same applies to a batch received via a purchase
 * invoice — `purchase_items.batch_id` is nullable, so deleting it would not
 * error, it would just silently detach the invoice from the batch it
 * actually paid for. Zeroing quantity (write-off) keeps the row and its
 * history intact; this function is only ever safe for a batch neither has
 * touched yet.
 */
export async function deleteBatch(batchId: number): Promise<Batch> {
  const [saleCount, purchaseItemCount] = await Promise.all([
    prisma.saleItem.count({ where: { batchId } }),
    prisma.purchaseItem.count({ where: { batchId } }),
  ]);
  if (saleCount > 0) {
    throw new AppError(409, 'لا يمكن حذف دفعة بيع منها سابقاً — صفّر كميتها بدلاً من ذلك عبر التعديل');
  }
  if (purchaseItemCount > 0) {
    throw new AppError(409, 'لا يمكن حذف دفعة مرتبطة بفاتورة شراء — صفّر كميتها بدلاً من ذلك عبر التعديل');
  }

  return prisma.batch.delete({ where: { id: batchId } });
}
