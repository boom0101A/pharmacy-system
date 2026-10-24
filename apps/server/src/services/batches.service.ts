import type { Batch } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/errors.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';
import { ARCHIVED_MESSAGE } from './products.service.js';

export interface AdjustBatchInput {
  /** The batch's correct remaining quantity. */
  quantity: number;
  /** What the form showed when it opened — guards against a sale in between. */
  expectedQuantity: number;
  reason: string;
}

/**
 * Corrects a batch's quantity that was typed in wrong (500 for 50). Logged
 * permanently with who, from what, to what and why — lowering stock without
 * a record is also how a sale goes unrecorded.
 *
 * When the batch came from a purchase invoice, that invoice line moves by the
 * same difference and the invoice total is recomputed, so the invoice and the
 * shelf never disagree. The difference, not the new value, because units
 * already sold from the batch were really received: 500 typed, 20 sold, 30
 * actually left → the invoice line becomes 50.
 */
export async function adjustBatchQuantity(batchId: number, userId: number, input: AdjustBatchInput): Promise<Batch> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: batchId }, include: { product: true } });
    if (!batch) throw new AppError(404, 'الدفعة غير موجودة');
    if (batch.product.archivedAt) throw new AppError(409, ARCHIVED_MESSAGE);
    if (input.quantity === input.expectedQuantity) {
      throw new AppError(400, 'الكمية الجديدة مطابقة للحالية — لا شيء لتعديله');
    }

    // Conditional on the quantity the user saw: a sale on another till since
    // the form opened must not be silently overwritten by this correction.
    const { count } = await tx.batch.updateMany({
      where: { id: batchId, quantity: input.expectedQuantity },
      data: { quantity: input.quantity },
    });
    if (count === 0) {
      throw new AppError(409, 'تغيّرت كمية هذه الدفعة للتو (بيع أو تعديل آخر) — أعد فتح النافذة وحاول مجدداً');
    }

    const difference = input.quantity - input.expectedQuantity;
    const line = await tx.purchaseItem.findFirst({ where: { batchId } });
    if (line) {
      await tx.purchaseItem.update({
        where: { id: line.id },
        data: { quantity: Math.max(0, line.quantity + difference) },
      });
      const items = await tx.purchaseItem.findMany({ where: { purchaseId: line.purchaseId } });
      const total = fromMinorUnits(
        items.reduce((sum, i) => sum + i.quantity * toMinorUnits(Number(i.unitPrice)), 0),
      );
      await tx.purchase.update({ where: { id: line.purchaseId }, data: { total } });
    }

    await tx.stockAdjustment.create({
      data: {
        batchId,
        userId,
        oldQuantity: input.expectedQuantity,
        newQuantity: input.quantity,
        reason: input.reason,
        purchaseItemId: line?.id ?? null,
      },
    });

    return tx.batch.findUniqueOrThrow({ where: { id: batchId } });
  });
}

/** A product's quantity corrections, newest first, with who made each. */
export async function listStockAdjustments(productId: number) {
  const rows = await prisma.stockAdjustment.findMany({
    where: { batch: { productId } },
    include: { user: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    batchId: r.batchId,
    oldQuantity: r.oldQuantity,
    newQuantity: r.newQuantity,
    reason: r.reason,
    userName: r.user.name,
    purchaseItemId: r.purchaseItemId,
    createdAt: r.createdAt.toISOString(),
  }));
}

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
    if (batch.quantity <= 0 && batch.openedSubUnits <= 0) {
      throw new AppError(409, 'رصيد هذه الدفعة صفر أصلاً — لا شيء لإتلافه');
    }

    // Baghdad's calendar date in SQL, not a JS Date check — this must agree
    // exactly with sales.service.ts's FEFO exclusion query (which uses the
    // same expression) on what "already expired" means, including the
    // edge case of a batch expiring today (still sellable, not yet
    // write-off-eligible) and no timezone drift between Node and Postgres.
    const [{ expired }] = await tx.$queryRaw<{ expired: boolean }[]>`
      SELECT expiry_date IS NOT NULL AND expiry_date < (now() AT TIME ZONE 'Asia/Baghdad')::date AS expired
      FROM batches WHERE id = ${batchId}
    `;
    if (!expired) {
      throw new AppError(409, 'لا يمكن إتلاف دفعة لم تنتهِ صلاحيتها بعد');
    }

    await tx.batchWriteOff.create({
      data: { batchId: batch.id, quantity: batch.quantity, userId },
    });

    // Loose strips from an opened package are on the same shelf and expire with
    // it; left behind, they could never be sold yet would block switching
    // sub-unit selling off for this product forever.
    return tx.batch.update({ where: { id: batchId }, data: { quantity: 0, openedSubUnits: 0 } });
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
    throw new AppError(409, 'لا يمكن حذف دفعة بيع منها سابقاً — صحّح كميتها بدلاً من ذلك (تعديل الكمية)');
  }
  if (purchaseItemCount > 0) {
    throw new AppError(409, 'لا يمكن حذف دفعة مرتبطة بفاتورة شراء — صحّح كميتها بدلاً من ذلك (تعديل الكمية)');
  }

  return prisma.batch.delete({ where: { id: batchId } });
}
