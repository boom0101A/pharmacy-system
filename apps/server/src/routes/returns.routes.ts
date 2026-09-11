import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import { createReturn, listReturns } from '../services/returns.service.js';

export const returnsRouter = Router();
returnsRouter.use(requireAuth);

const returnSchema = z.object({
  saleId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        saleItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'لم تُحدَّد أي أصناف للإرجاع'),
  reason: z.string().trim().min(1).nullish(),
});

// A cashier processes a return at the counter, same as ringing up a sale.
returnsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = returnSchema.parse(req.body);
    res.status(201).json(await createReturn(req.auth!.userId, input));
  }),
);

// The return history reveals takings/losses, so it stays with admin/pharmacist.
returnsRouter.get(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (_req, res) => {
    res.json(await listReturns());
  }),
);
