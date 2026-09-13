import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma.js';

const broadcastStockChanged = vi.fn();
vi.mock('../../sockets/stock.js', () => ({
  broadcastStockChanged: (...args: unknown[]) => broadcastStockChanged(...args),
}));

const { createPurchase } = await import('../../services/purchases.service.js');

async function seedSupplierAndProduct() {
  const user = await prisma.user.create({
    data: { name: 'صيدلاني', username: `pharmacist-${Date.now()}-${Math.random()}`, passwordHash: 'x', role: 'pharmacist' },
  });
  const supplier = await prisma.supplier.create({ data: { name: `مورد ${Date.now()}` } });
  const product = await prisma.product.create({
    data: { name: 'دواء اختبار الشراء', salePrice: '10', purchasePrice: '5' },
  });
  return { user, supplier, product };
}

describe('createPurchase stock broadcast', () => {
  beforeEach(() => {
    broadcastStockChanged.mockClear();
  });

  it('tells other tills the received product changed, same as receiving a batch directly does', async () => {
    const { user, supplier, product } = await seedSupplierAndProduct();

    await createPurchase(user.id, {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitPrice: 5 }],
    });

    expect(broadcastStockChanged).toHaveBeenCalledTimes(1);
    expect(broadcastStockChanged).toHaveBeenCalledWith([product.id]);
  });
});
