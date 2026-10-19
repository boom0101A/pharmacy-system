import type { Sale, SaleInput } from '@pharmacy/shared-types';
import { Prisma } from '@prisma/client';
import { prisma, toNumber } from '../prisma.js';
import { AppError } from '../middleware/errors.js';
import { broadcastStockChanged } from '../sockets/stock.js';
import { ARCHIVED_MESSAGE } from './products.service.js';

function mapSale(row: {
  id: number;
  userId: number;
  date: Date;
  total: unknown;
  discount: unknown;
  items: {
    id: number;
    saleId: number;
    productId: number;
    batchId: number | null;
    quantity: number;
    unitPrice: unknown;
    isSubUnit: boolean;
  }[];
}): Sale {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date.toISOString(),
    total: toNumber(row.total as Parameters<typeof toNumber>[0]),
    discount: toNumber(row.discount as Parameters<typeof toNumber>[0]),
    items: row.items.map((i) => ({
      id: i.id,
      saleId: i.saleId,
      productId: i.productId,
      batchId: i.batchId,
      quantity: i.quantity,
      unitPrice: toNumber(i.unitPrice as Parameters<typeof toNumber>[0]),
      isSubUnit: i.isSubUnit,
    })),
  };
}

/**
 * Rings up a sale inside one transaction: locks every batch it touches
 * (`SELECT ... FOR UPDATE`) so two tills can never both sell the last unit,
 * then draws from the nearest-expiring batch first (FEFO) — a single line
 * can span more than one batch if the first one doesn't have enough left.
 */
export async function createSale(userId: number, input: SaleInput): Promise<Sale> {
  if (input.items.length === 0) {
    throw new AppError(400, 'الفاتورة فارغة');
  }

  // A retried checkout carries the same key — hand back the invoice that
  // already exists instead of selling everything twice.
  if (input.idempotencyKey) {
    const existing = await prisma.sale.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) return mapSale(existing);
  }

  const result = await prisma.$transaction(async (tx) => {
    const affectedProductIds = new Set<number>();
    const lineData: {
      productId: number;
      batchId: number | null;
      quantity: number;
      unitPrice: number;
      isSubUnit: boolean;
      subUnitsPerPackage?: number | null;
    }[] = [];

    // Locked in one global order (by product id): two sales of [A, B] and
    // [B, A] would otherwise each hold one product's batches while waiting for
    // the other's — a deadlock Postgres resolves by failing one sale.
    const orderedItems = [...input.items].sort((a, b) => a.productId - b.productId);
    for (const line of orderedItems) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) {
        throw new AppError(404, `الصنف رقم ${line.productId} غير موجود`);
      }
      if (product.archivedAt) throw new AppError(409, `«${product.name}»: ${ARCHIVED_MESSAGE}`);
      affectedProductIds.add(product.id);

      // productSchema.refine() requires subUnitPrice on every new write, but
      // a row created before that fix can still have it null — falling back
      // to salePrice (the whole-package price) would silently overcharge by
      // roughly unitsPerPackage times at checkout.
      if (line.isSubUnit && product.subUnitPrice === null) {
        throw new AppError(400, `"${product.name}" بلا سعر محدد للوحدة الفرعية — راجع بيانات الصنف`);
      }

      const unitPrice = line.isSubUnit ? toNumber(product.subUnitPrice!) : toNumber(product.salePrice);

      // Lock every batch of this product up front, oldest expiry first —
      // this is the FEFO order the draw-down loop below follows. A batch
      // that has already expired is excluded entirely rather than just
      // sorted first: FEFO means "soonest valid expiry first", not "sell
      // expired stock before anything else" — an expiry date entered
      // wrong at receiving must never make a batch more likely to sell.
      const batches = await tx.$queryRaw<
        { id: number; quantity: number; opened_sub_units: number }[]
      >`SELECT id, quantity, opened_sub_units FROM batches
         WHERE product_id = ${product.id}
           AND (expiry_date IS NULL OR expiry_date >= (now() AT TIME ZONE 'Asia/Baghdad')::date)
         ORDER BY expiry_date ASC NULLS LAST, received_at ASC
         FOR UPDATE`;

      let remaining = line.quantity;

      if (line.isSubUnit) {
        if (!product.unitsPerPackage) {
          throw new AppError(400, `"${product.name}" لا يُباع بالتجزئة`);
        }
        for (const batch of batches) {
          if (remaining <= 0) break;

          // Loose units already opened from this batch go first.
          const fromLoose = Math.min(batch.opened_sub_units, remaining);
          if (fromLoose > 0) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { openedSubUnits: { decrement: fromLoose } },
            });
            lineData.push({
              productId: product.id,
              batchId: batch.id,
              quantity: fromLoose,
              unitPrice,
              isSubUnit: true,
              subUnitsPerPackage: product.unitsPerPackage,
            });
            remaining -= fromLoose;
          }
          if (remaining <= 0) break;

          // Not enough loose stock — open whole packages one at a time.
          while (remaining > 0 && batch.quantity > 0) {
            batch.quantity -= 1;
            const fromThisPackage = Math.min(product.unitsPerPackage, remaining);
            await tx.batch.update({
              where: { id: batch.id },
              data: {
                quantity: { decrement: 1 },
                openedSubUnits: { increment: product.unitsPerPackage - fromThisPackage },
              },
            });
            lineData.push({
              productId: product.id,
              batchId: batch.id,
              quantity: fromThisPackage,
              unitPrice,
              isSubUnit: true,
              subUnitsPerPackage: product.unitsPerPackage,
            });
            remaining -= fromThisPackage;
          }
        }
      } else {
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.quantity, remaining);
          if (take <= 0) continue;

          await tx.batch.update({ where: { id: batch.id }, data: { quantity: { decrement: take } } });
          lineData.push({
            productId: product.id,
            batchId: batch.id,
            quantity: take,
            unitPrice,
            isSubUnit: false,
          });
          remaining -= take;
        }
      }

      if (remaining > 0) {
        throw new AppError(409, `الكمية المتوفرة من "${product.name}" غير كافية`);
      }
    }

    // Total is computed from the actual line quantities/prices, not the
    // requested ones — matters when a line was split across batches above.
    const subtotal = lineData.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const discount = input.discount ?? 0;
    // A discount above the subtotal used to be stored as-is (total clamped to
    // 0), which later turned any return on the invoice into a negative refund.
    if (discount > subtotal) {
      throw new AppError(400, 'الخصم أكبر من مجموع الفاتورة');
    }
    const total = subtotal - discount;

    const sale = await tx.sale.create({
      data: {
        userId,
        total,
        discount,
        idempotencyKey: input.idempotencyKey,
        items: { createMany: { data: lineData } },
      },
      include: { items: true },
    });

    return { sale, affectedProductIds: [...affectedProductIds] };
  }).catch((err: unknown) => {
    // Two retries of the same checkout racing each other: both passed the
    // lookup above, and the second insert hits the unique key. That is the
    // idempotency doing its job — answer with the invoice that won.
    if (
      input.idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return null;
    }
    throw err;
  });

  if (result === null) {
    const existing = await prisma.sale.findUniqueOrThrow({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    return mapSale(existing);
  }

  broadcastStockChanged(result.affectedProductIds);
  return mapSale(result.sale);
}
