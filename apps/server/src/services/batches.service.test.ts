import { describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { deleteBatch } from './batches.service.js';
import { AppError } from '../middleware/errors.js';

async function seedProduct() {
  return prisma.product.create({
    data: { name: `دواء-${Date.now()}-${Math.random()}`, salePrice: '10', purchasePrice: '5' },
  });
}

describe('deleteBatch', () => {
  it('deletes a batch that was never sold from and never received via a purchase invoice', async () => {
    const product = await seedProduct();
    const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });

    await deleteBatch(batch.id);

    await expect(prisma.batch.findUnique({ where: { id: batch.id } })).resolves.toBeNull();
  });

  it('rejects deleting a batch already drawn from by a sale', async () => {
    const product = await seedProduct();
    const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });
    const user = await prisma.user.create({
      data: { name: 'كاشير', username: `c-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'cashier' },
    });
    const sale = await prisma.sale.create({ data: { userId: user.id, total: '10', discount: '0' } });
    await prisma.saleItem.create({
      data: { saleId: sale.id, productId: product.id, batchId: batch.id, quantity: 1, unitPrice: '10' },
    });

    await expect(deleteBatch(batch.id)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects deleting a batch received via a purchase invoice, even though nothing has sold from it yet, to avoid silently orphaning the invoice\'s batch link', async () => {
    const product = await seedProduct();
    const batch = await prisma.batch.create({ data: { productId: product.id, quantity: 5 } });
    const supplier = await prisma.supplier.create({ data: { name: `مورد-${Date.now()}` } });
    const user = await prisma.user.create({
      data: { name: 'مدير', username: `a-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'admin' },
    });
    const purchase = await prisma.purchase.create({
      data: { supplierId: supplier.id, userId: user.id, status: 'received', total: '50' },
    });
    await prisma.purchaseItem.create({
      data: { purchaseId: purchase.id, productId: product.id, batchId: batch.id, quantity: 5, unitPrice: '10' },
    });

    await expect(deleteBatch(batch.id)).rejects.toBeInstanceOf(AppError);

    const stillThere = await prisma.batch.findUnique({ where: { id: batch.id } });
    expect(stillThere).not.toBeNull();
  });
});
