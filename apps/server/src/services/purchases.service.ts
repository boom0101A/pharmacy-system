import type { Purchase, PurchaseInput } from '@pharmacy/shared-types';
import { prisma, toNumber } from '../prisma.js';
import { AppError } from '../middleware/errors.js';
import { broadcastStockChanged } from '../sockets/stock.js';
import { baghdadTodayIso } from '../lib/dateRange.js';
import { fromMinorUnits, toMinorUnits } from '../lib/money.js';

function present(row: {
  id: number;
  supplierId: number;
  supplier: { name: string };
  userId: number;
  user: { name: string };
  date: Date;
  total: unknown;
  status: string;
  items: {
    id: number;
    purchaseId: number;
    productId: number;
    product: { name: string };
    batchId: number | null;
    quantity: number;
    unitPrice: unknown;
    batchNumber: string | null;
    expiryDate: Date | null;
  }[];
}): Purchase {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    userId: row.userId,
    userName: row.user.name,
    date: row.date.toISOString(),
    total: toNumber(row.total as Parameters<typeof toNumber>[0]),
    status: row.status as Purchase['status'],
    items: row.items.map((i) => ({
      id: i.id,
      purchaseId: i.purchaseId,
      productId: i.productId,
      productName: i.product.name,
      batchId: i.batchId,
      quantity: i.quantity,
      unitPrice: toNumber(i.unitPrice as Parameters<typeof toNumber>[0]),
      batchNumber: i.batchNumber,
      expiryDate: i.expiryDate ? i.expiryDate.toISOString() : null,
    })),
  };
}

const include = {
  supplier: { select: { name: true } },
  user: { select: { name: true } },
  items: { include: { product: { select: { name: true } } } },
} as const;

/**
 * Recording a purchase invoice both logs it and receives the stock in one
 * step — each line becomes its own batch, exactly as "استلام دفعة" would,
 * so a purchase invoice never needs a second trip to Inventory afterward.
 */
export async function createPurchase(userId: number, input: PurchaseInput): Promise<Purchase> {
  if (input.items.length === 0) {
    throw new AppError(400, 'فاتورة الشراء فارغة');
  }

  // Same rule the batch write-off and FEFO sale use: expiring today is still sellable.
  const today = baghdadTodayIso();
  for (const line of input.items) {
    if (line.expiryDate && line.expiryDate.slice(0, 10) < today) {
      const product = await prisma.product.findUnique({ where: { id: line.productId }, select: { name: true } });
      throw new AppError(400, `تاريخ انتهاء "${product?.name ?? line.productId}" قد مضى — لا يمكن استلام دواء منتهي الصلاحية`);
    }
  }

  const total = fromMinorUnits(
    input.items.reduce((sum, i) => sum + i.quantity * toMinorUnits(i.unitPrice), 0),
  );

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        supplierId: input.supplierId,
        userId,
        total,
        status: 'received',
      },
    });

    for (const line of input.items) {
      const batch = await tx.batch.create({
        data: {
          productId: line.productId,
          batchNumber: line.batchNumber || null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          quantity: line.quantity,
          purchasePrice: line.unitPrice,
        },
      });
      await tx.purchaseItem.create({
        data: {
          purchaseId: created.id,
          productId: line.productId,
          batchId: batch.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          batchNumber: line.batchNumber || null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        },
      });
      // The supplier's most recent cost becomes the product's reference
      // purchase price for margin reporting, without touching its sale price.
      // A free bonus line (10+1) is not a cost and must not zero it.
      if (line.unitPrice > 0) {
        await tx.product.update({
          where: { id: line.productId },
          data: { purchasePrice: line.unitPrice },
        });
      }
    }

    return tx.purchase.findUniqueOrThrow({ where: { id: created.id }, include });
  });

  // Same notification "استلام دفعة" already sends via batches.routes.ts —
  // without it, other open tills kept showing the pre-purchase quantity
  // until something else happened to trigger a refetch.
  const productIds = [...new Set(input.items.map((line) => line.productId))];
  broadcastStockChanged(productIds);

  return present(purchase);
}

export async function listPurchases(): Promise<Purchase[]> {
  const rows = await prisma.purchase.findMany({ include, orderBy: { date: 'desc' }, take: 200 });
  return rows.map(present);
}
