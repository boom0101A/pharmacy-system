import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { prisma } from '../../prisma.js';
import { writeBackup } from '../../backup.js';
import { createPurchase } from '../../services/purchases.service.js';
import { createSale } from '../../services/sales.service.js';
import { createReturn } from '../../services/returns.service.js';
import { resetDatabase } from '../../../vitest.setup.js';
import { applyRestore } from '../../../scripts/restore.js';

/**
 * This is the check the codebase's own comments say should exist
 * ("restore.test-drive.mjs") but never actually did — a backup file has been
 * written every 24 hours since this project started, and nobody had ever
 * verified restoring one actually works.
 */
describe('backup + restore round-trip', () => {
  let uploadsSrc: string;

  beforeEach(async () => {
    uploadsSrc = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-src-'));
    config.backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-dest-'));
  });

  it('reproduces every table exactly after a full wipe, including a purchase, sale, and return', async () => {
    // Seed one row touching every table in the backup, through the same
    // service functions the real app uses (not raw fixtures) so the shapes
    // being backed up and restored are exactly what production ever writes.
    const admin = await prisma.user.create({
      data: { name: 'مدير الاستعادة', username: `restore-admin-${Date.now()}`, passwordHash: 'x', role: 'admin' },
    });
    const category = await prisma.category.create({ data: { name: `تصنيف-${Date.now()}` } });
    const supplier = await prisma.supplier.create({ data: { name: `مورد-${Date.now()}` } });
    const product = await prisma.product.create({
      data: {
        name: 'دواء الاستعادة',
        salePrice: '20',
        purchasePrice: '10',
        categoryId: category.id,
      },
    });

    await createPurchase(admin.id, {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 30, unitPrice: 10 }],
    });

    const sale = await createSale(admin.id, { items: [{ productId: product.id, quantity: 5 }] });

    await createReturn(admin.id, {
      saleId: sale.id,
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
    });

    const before = {
      users: await prisma.user.count(),
      categories: await prisma.category.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      batches: await prisma.batch.count(),
      purchases: await prisma.purchase.count(),
      purchaseItems: await prisma.purchaseItem.count(),
      sales: await prisma.sale.count(),
      saleItems: await prisma.saleItem.count(),
      returns: await prisma.return.count(),
      returnItems: await prisma.returnItem.count(),
    };
    const productBefore = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const batchBefore = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });

    const backupFile = await writeBackup(uploadsSrc);
    const payload = JSON.parse(await fs.readFile(backupFile, 'utf8'));

    // The disaster this whole mechanism exists for: everything is gone.
    await resetDatabase();
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.product.count()).toBe(0);

    await applyRestore(payload);

    const after = {
      users: await prisma.user.count(),
      categories: await prisma.category.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      batches: await prisma.batch.count(),
      purchases: await prisma.purchase.count(),
      purchaseItems: await prisma.purchaseItem.count(),
      sales: await prisma.sale.count(),
      saleItems: await prisma.saleItem.count(),
      returns: await prisma.return.count(),
      returnItems: await prisma.returnItem.count(),
    };
    expect(after).toEqual(before);

    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productAfter).toEqual(productBefore);
    const batchAfter = await prisma.batch.findFirstOrThrow({ where: { productId: product.id } });
    expect(batchAfter).toEqual(batchBefore);

    // A fresh row must not collide with a restored id — proves the
    // per-table sequence reset in applyRestore actually ran.
    const newCategory = await prisma.category.create({ data: { name: `تصنيف-جديد-${Date.now()}` } });
    expect(newCategory.id).toBeGreaterThan(category.id);
  });
});
