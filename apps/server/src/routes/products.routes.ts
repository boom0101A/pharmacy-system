import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { checkRole, requireAuth } from '../middleware/auth.js';
import * as products from '../services/products.service.js';
import { saveProductImage } from '../services/productImage.service.js';
import { createCaptureCode } from '../services/captureCode.service.js';
import { CAPTURE_TOKEN_TTL_SECONDS } from '../middleware/auth.js';
import { lanOrigin } from '../lib/lanUrl.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const productsRouter = Router();
productsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function uploadDir() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads', 'products');
}

const productSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  barcode: z.string().trim().min(1).nullish(),
  categoryId: z.number().int().positive().nullish(),
  unit: z.string().min(1).default('علبة'),
  salePrice: z.number().nonnegative(),
  purchasePrice: z.number().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(0),
  unitsPerPackage: z.number().int().min(2).nullish(),
  subUnitName: z.string().trim().min(1).nullish(),
  subUnitPrice: z.number().nonnegative().nullish(),
  activeIngredient: z.string().trim().min(1).nullish(),
  dosageForm: z.string().trim().min(1).nullish(),
  strength: z.string().trim().min(1).nullish(),
});

function toCreateData(data: z.infer<typeof productSchema>): products.ProductCreateData {
  return {
    name: data.name,
    barcode: data.barcode || null,
    categoryId: data.categoryId ?? null,
    unit: data.unit,
    salePrice: data.salePrice,
    purchasePrice: data.purchasePrice,
    reorderLevel: data.reorderLevel,
    unitsPerPackage: data.unitsPerPackage ?? null,
    subUnitName: data.subUnitName || null,
    subUnitPrice: data.subUnitPrice ?? null,
    activeIngredient: data.activeIngredient || null,
    dosageForm: data.dosageForm || null,
    strength: data.strength || null,
  };
}

const toUpdateData = toCreateData;

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['low', 'expiring', 'out']).optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(await products.listProducts(query));
  }),
);

productsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(await products.productStats(search));
  }),
);

/** Suggestions only for the product form's autocomplete. */
productsRouter.get(
  '/ingredients',
  asyncHandler(async (_req, res) => {
    res.json(await products.productIngredients());
  }),
);

productsRouter.get(
  '/barcode/:barcode',
  asyncHandler(async (req, res) => {
    const product = await products.findByBarcode(req.params.barcode);
    if (!product) throw new AppError(404, 'لم يُعثر على صنف بهذا الباركود');
    res.json(product);
  }),
);

productsRouter.get(
  '/:id/alternatives',
  asyncHandler(async (req, res) => {
    res.json(await products.productAlternatives(Number(req.params.id)));
  }),
);

// Editing the catalogue and prices is off-limits to the cashier.
productsRouter.post(
  '/',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    res.status(201).json(await products.createProduct(toCreateData(data)));
  }),
);

productsRouter.put(
  '/:id',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = productSchema.parse(req.body);

    // Switching divisibility off would strand any loose sub-units: the POS
    // sub-unit button needs unitsPerPackage/subUnitPrice to render, and the
    // main button is disabled once the sealed packages are gone. The stock
    // would still be counted, would still hold off the "out of stock" flag,
    // and could not be sold by any route — so refuse instead.
    if (!data.unitsPerPackage) {
      const loose = await prisma.batch.aggregate({
        where: { productId: id },
        _sum: { openedSubUnits: true },
      });
      if ((loose._sum.openedSubUnits ?? 0) > 0) {
        throw new AppError(
          409,
          'لا يمكن إيقاف التجزئة وهناك وحدات مفكوكة بالمخزون — بِعها أولاً، فهي لا تُباع إلا بالتجزئة',
        );
      }
    }

    res.json(await products.updateProduct(id, toUpdateData(data)));
  }),
);

productsRouter.delete(
  '/:id',
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError(404, 'الدواء غير موجود');
    }

    // The database would refuse this anyway (the sale/purchase relations are
    // restrict), but its generic foreign-key message doesn't tell a pharmacist
    // *why* — and "history exists" is the one reason worth naming precisely.
    const [soldCount, purchasedCount] = await Promise.all([
      prisma.saleItem.count({ where: { productId: id } }),
      prisma.purchaseItem.count({ where: { productId: id } }),
    ]);
    if (soldCount > 0 || purchasedCount > 0) {
      throw new AppError(
        409,
        'لا يمكن حذف دواء له فواتير بيع أو شراء سابقة — سجلّ الفواتير والتقارير يعتمد عليه',
      );
    }

    await prisma.product.delete({ where: { id } });

    // Best-effort: past the guard above nothing else references this product,
    // so the file is genuinely orphaned now.
    if (product.imageFilename) {
      await fs.unlink(path.join(uploadDir(), product.imageFilename)).catch(() => {});
    }

    res.status(204).end();
  }),
);

/**
 * Mints the URL behind the QR code the desktop shows. Scanning it hands the
 * phone a grant good for one product and ten minutes — no password typed on
 * the phone, and nothing else the token could be used for.
 */
productsRouter.post(
  '/:id/capture-token',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new AppError(400, 'معرّف الصنف غير صالح');
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError(404, 'الصنف غير موجود');
    }

    res.status(201).json({
      // Short on purpose — see captureCode.service. /c/:code redirects to the
      // capture page carrying the signed token.
      url: `${lanOrigin(req)}/c/${createCaptureCode(id)}`,
      expiresInSeconds: CAPTURE_TOKEN_TTL_SECONDS,
    });
  }),
);

// Same permission level as editing the product itself.
productsRouter.post(
  '/:id/image',
  checkRole('admin', 'pharmacist'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'لم يُرفَع أي ملف');
    }
    const filename = await saveProductImage(Number(req.params.id), req.file.buffer);
    res.status(201).json({ imageFilename: filename });
  }),
);
