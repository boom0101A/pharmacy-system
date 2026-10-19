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
import { config } from '../config.js';
import { parseIdParam } from '../lib/parseIdParam.js';
import { withoutCostFor } from '../lib/costVisibility.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function uploadDir() {
  return path.join(config.uploadsDir, 'products');
}

export const productSchema = z
  .object({
    name: z.string().min(1, 'الاسم مطلوب'),
    barcode: z.string().trim().min(1).nullish(),
    categoryId: z.number().int().positive().nullish(),
    unit: z.string().min(1).default('علبة'),
    salePrice: z.number().nonnegative().finite(),
    purchasePrice: z.number().nonnegative().finite(),
    reorderLevel: z.number().int().nonnegative().default(0),
    unitsPerPackage: z.number().int().min(2).nullish(),
    subUnitName: z.string().trim().min(1).nullish(),
    subUnitPrice: z.number().nonnegative().finite().nullish(),
    activeIngredient: z.string().trim().min(1).nullish(),
    dosageForm: z.string().trim().min(1).nullish(),
    strength: z.string().trim().min(1).nullish(),
  })
  .refine(
    (data) => {
      // subUnitPrice falls back to salePrice (the whole-package price)
      // whenever it is null — selling "half a strip" at the full-box price is
      // a silent ~10x overcharge, not something anyone would notice at
      // checkout. All three together or none, nothing in between.
      const fields = [data.unitsPerPackage, data.subUnitName, data.subUnitPrice];
      return fields.every((f) => f == null) || fields.every((f) => f != null);
    },
    { message: 'عند تفعيل بيع الوحدة الفرعية، يجب ضبط عدد الوحدات واسم الوحدة وسعرها معاً' },
  );

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
  status: z.enum(['low', 'expiring', 'out', 'archived']).optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(withoutCostFor(req.auth!.role, await products.listProducts(query)));
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

// Before '/barcode/:barcode', which would otherwise take "new" as a barcode.
productsRouter.get(
  '/barcode/new',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (_req, res) => {
    res.json({ barcode: await products.newUniqueBarcode() });
  }),
);

productsRouter.get(
  '/barcode/:barcode',
  asyncHandler(async (req, res) => {
    const product = await products.findByBarcode(req.params.barcode);
    if (!product) throw new AppError(404, 'لم يُعثر على صنف بهذا الباركود');
    res.json(withoutCostFor(req.auth!.role, [product])[0]);
  }),
);

productsRouter.get(
  '/:id/alternatives',
  asyncHandler(async (req, res) => {
    res.json(await products.productAlternatives(parseIdParam(req.params.id, 'معرّف الصنف')));
  }),
);

// Registered after the fixed paths above (/stats, /ingredients, /barcode/…) so
// it never shadows them.
productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await products.findById(parseIdParam(req.params.id, 'معرّف الصنف'));
    if (!product) throw new AppError(404, 'الصنف غير موجود');
    res.json(withoutCostFor(req.auth!.role, [product])[0]);
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
    const id = parseIdParam(req.params.id, 'معرّف الصنف');
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
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id, 'معرّف الصنف');
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError(404, 'الدواء غير موجود');
    }

    const result = await products.archiveOrDeleteProduct(id);

    // Only a real delete orphans the photo — an archived product keeps it for
    // the day it is restored.
    if (!result.archived && product.imageFilename) {
      await fs.unlink(path.join(uploadDir(), product.imageFilename)).catch(() => {});
    }

    res.json(result);
  }),
);

productsRouter.post(
  '/:id/restore',
  checkRole('admin', 'pharmacist'),
  asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id, 'معرّف الصنف');
    if (!(await prisma.product.findUnique({ where: { id } }))) throw new AppError(404, 'الدواء غير موجود');
    res.json(await products.restoreProduct(id));
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
    const filename = await saveProductImage(parseIdParam(req.params.id, 'معرّف الصنف'), req.file.buffer);
    res.status(201).json({ imageFilename: filename });
  }),
);
