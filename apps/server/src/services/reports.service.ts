import type { WriteOffReportRow } from '@pharmacy/shared-types';
import { prisma } from '../prisma.js';

export async function getWriteOffsReport(): Promise<WriteOffReportRow[]> {
  const rows = await prisma.batchWriteOff.findMany({
    include: { batch: { include: { product: true } }, user: true },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    productName: r.batch.product.name,
    quantity: r.quantity,
    batchExpiryDate: r.batch.expiryDate?.toISOString() ?? null,
    userName: r.user.name,
    createdAt: r.createdAt.toISOString(),
  }));
}
