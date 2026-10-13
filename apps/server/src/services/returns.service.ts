import type { Return, ReturnInput } from '@pharmacy/shared-types';
import { prisma, toNumber } from '../prisma.js';
import { AppError } from '../middleware/errors.js';
import { broadcastStockChanged } from '../sockets/stock.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';

/**
 * Processes a (possibly partial) return against a completed sale.
 *
 * Each returned unit goes back to the exact batch it was originally drawn
 * from (sale_items.batch_id) — not wherever FEFO would currently pick — so
 * the item's real expiry/cost basis stays correct. This only works because
 * batches referenced by a sale can't be deleted (see batches.routes.ts).
 */
export async function createReturn(userId: number, input: ReturnInput): Promise<Return> {
  if (input.items.length === 0) {
    throw new AppError(400, 'لم تُحدَّد أي أصناف للإرجاع');
  }
  // The "already returned" check below reads committed return_items, and this
  // return's own rows are only written after the loop — so the same line
  // listed twice would pass the check twice and refund more than was sold.
  if (new Set(input.items.map((i) => i.saleItemId)).size !== input.items.length) {
    throw new AppError(400, 'تكرّر نفس الصنف في طلب الإرجاع — اجمع الكمية في سطر واحد');
  }

  const result = await prisma.$transaction(async (tx) => {
    // One return per invoice at a time. The per-line locks below don't stop
    // two returns on *different* lines from both reading the same "already
    // refunded" total and together paying out more than the invoice took in.
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${input.saleId} FOR UPDATE`;
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      // Every line, not just the returned ones: the discount share is worked
      // out against the whole invoice.
      include: { items: true },
    });
    if (!sale) {
      throw new AppError(404, 'الفاتورة غير موجودة');
    }

    const subtotalMinor = sale.items.reduce(
      (sum, item) => sum + item.quantity * toMinorUnits(toNumber(item.unitPrice)),
      0,
    );
    const discountMinor = toMinorUnits(toNumber(sale.discount));

    // The customer paid the discounted amount, so a return gives back that same
    // share. Refunding the list price would hand them the discount back in cash
    // on top of the goods — money straight out of the till.
    // Clamped: a sale saved before discounts were capped at the subtotal would
    // otherwise produce a negative ratio, and with it a negative refund.
    const paidRatio =
      subtotalMinor > 0 ? Math.min(1, Math.max(0, (subtotalMinor - discountMinor) / subtotalMinor)) : 0;

    let totalMinor = 0;
    const affectedProductIds = new Set<number>();
    const returnItems: {
      saleItemId: number;
      quantity: number;
      unitPrice: number;
      isSubUnit: boolean;
    }[] = [];

    for (const line of input.items) {
      if (line.quantity <= 0) {
        throw new AppError(400, 'كمية الإرجاع يجب أن تكون أكبر من صفر');
      }

      // Lock this sale line for the rest of the transaction, the same way a
      // sale locks its batches. Without it two returns processed at the same
      // moment both read "nothing returned yet" and both refund in full.
      await tx.$queryRaw`SELECT id FROM sale_items WHERE id = ${line.saleItemId} FOR UPDATE`;

      const saleItem = await tx.saleItem.findUnique({ where: { id: line.saleItemId } });
      if (!saleItem || saleItem.saleId !== input.saleId) {
        throw new AppError(404, `سطر الفاتورة رقم ${line.saleItemId} غير موجود بهذه الفاتورة`);
      }

      const alreadyReturned = await tx.returnItem.aggregate({
        where: { saleItemId: line.saleItemId },
        _sum: { quantity: true },
      });
      const returnedSoFar = alreadyReturned._sum.quantity ?? 0;
      const remaining = saleItem.quantity - returnedSoFar;

      if (line.quantity > remaining) {
        throw new AppError(
          409,
          `الكمية المتاحة للإرجاع من هذا الصنف هي ${remaining} فقط`,
        );
      }

      if (saleItem.batchId) {
        // A sub-unit sale opened a package and drew from its loose remainder,
        // never touching `quantity` — the reverse only ever needs to hand
        // that same amount of loose stock back. Bounded by construction: a
        // return can never exceed `saleItem.quantity`, which is exactly what
        // was drawn from this one batch in the first place, so this can't
        // push `openedSubUnits` past a full package's worth.
        await tx.batch.update({
          where: { id: saleItem.batchId },
          data: saleItem.isSubUnit
            ? { openedSubUnits: { increment: line.quantity } }
            : { quantity: { increment: line.quantity } },
        });
      }

      const unitPrice = toNumber(saleItem.unitPrice);
      totalMinor += Math.round(line.quantity * toMinorUnits(unitPrice) * paidRatio);
      affectedProductIds.add(saleItem.productId);
      returnItems.push({
        saleItemId: line.saleItemId,
        quantity: line.quantity,
        unitPrice,
        isSubUnit: saleItem.isSubUnit,
      });
    }

    // Each line rounds on its own, so several partial returns can add up to a
    // cent or two more than the invoice took in (3 × 0.67 against 2.00 paid).
    // Never let refunds on one invoice exceed what was actually paid for it.
    const previousRefunds = await tx.return.aggregate({ where: { saleId: input.saleId }, _sum: { total: true } });
    const refundableMinor =
      toMinorUnits(toNumber(sale.total)) -
      (previousRefunds._sum.total ? toMinorUnits(toNumber(previousRefunds._sum.total)) : 0);
    totalMinor = Math.min(totalMinor, Math.max(0, refundableMinor));

    const created = await tx.return.create({
      data: {
        saleId: input.saleId,
        userId,
        total: fromMinorUnits(totalMinor),
        reason: input.reason || null,
        items: { createMany: { data: returnItems } },
      },
      include: { items: true, user: { select: { name: true } } },
    });

    return { created, affectedProductIds: [...affectedProductIds] };
  });

  broadcastStockChanged(result.affectedProductIds);

  const { created } = result;
  return {
    id: created.id,
    saleId: created.saleId,
    userId: created.userId,
    userName: created.user.name,
    date: created.date.toISOString(),
    total: toNumber(created.total),
    reason: created.reason,
    items: created.items.map((item) => ({
      id: item.id,
      returnId: item.returnId,
      saleItemId: item.saleItemId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      isSubUnit: item.isSubUnit,
    })),
  };
}

export async function listReturns(): Promise<Return[]> {
  const rows = await prisma.return.findMany({
    include: { items: true, user: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return rows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    userId: r.userId,
    userName: r.user.name,
    date: r.date.toISOString(),
    total: toNumber(r.total),
    reason: r.reason,
    items: r.items.map((item) => ({
      id: item.id,
      returnId: item.returnId,
      saleItemId: item.saleItemId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      isSubUnit: item.isSubUnit,
    })),
  }));
}
