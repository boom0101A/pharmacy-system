import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { createPurchase, listPurchases } from '../services/purchases.service.js';

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);
// Purchasing power (and the cost data it reveals) stays with admin/pharmacist.
purchasesRouter.use(checkRole('admin', 'pharmacist'));

export const purchaseSchema = z.object({
  supplierId: z.number({ message: 'اختر المورّد' }).int().positive('اختر المورّد'),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number({ message: 'الكمية غير صالحة' }).int('الكمية يجب أن تكون عدداً صحيحاً').positive('الكمية يجب أن تكون أكبر من صفر'),
        unitPrice: z.number({ message: 'سعر الشراء غير صالح' }).nonnegative('سعر الشراء لا يكون سالباً').finite('سعر الشراء غير صالح'),
        batchNumber: z.string().trim().min(1).nullish(),
        expiryDate: z.coerce
          .date({ message: 'تاريخ الانتهاء غير صالح' })
          .min(new Date('2000-01-01'), 'تاريخ الانتهاء غير صالح')
          .max(new Date('2100-01-01'), 'تاريخ الانتهاء غير صالح')
          .nullish(),
      }),
    )
    .min(1, 'فاتورة الشراء فارغة'),
});

purchasesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listPurchases());
  }),
);

purchasesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = purchaseSchema.parse(req.body);
    res.status(201).json(
      await createPurchase(req.auth!.userId, {
        supplierId: input.supplierId,
        items: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate ? i.expiryDate.toISOString() : null,
        })),
      }),
    );
  }),
);
