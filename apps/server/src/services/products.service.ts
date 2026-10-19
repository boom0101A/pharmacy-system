import type { Product, ProductAlternative } from '@pharmacy/shared-types';
import { Prisma } from '@prisma/client';
import { prisma, toNumber } from '../prisma.js';
import { baghdadTodayIso } from '../lib/dateRange.js';
import { internalBarcode } from '../lib/barcode.js';
import { AppError } from '../middleware/errors.js';

// A product "قارب على الانتهاء" (expiring soon) inside this many days of its
// nearest batch — chosen to give a pharmacist a working month's notice.
const EXPIRY_WARNING_DAYS = 30;

export interface ProductCreateData {
  name: string;
  barcode: string | null;
  categoryId: number | null;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  reorderLevel: number;
  unitsPerPackage: number | null;
  subUnitName: string | null;
  subUnitPrice: number | null;
  activeIngredient: string | null;
  dosageForm: string | null;
  strength: string | null;
}

export type ProductUpdateData = ProductCreateData;

type ProductRow = Awaited<ReturnType<typeof productWithAggregates>>[number];

/**
 * One query, not one-per-product: aggregates each product's live stock (the
 * sum of its batches, never stored on the product row itself) and nearest
 * upcoming expiry among batches that still have something in them.
 */
function productWithAggregates(where?: Prisma.ProductWhereInput) {
  return prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      batches: { select: { quantity: true, expiryDate: true, openedSubUnits: true } },
    },
  });
}

function present(row: ProductRow): Product {
  // Only batches that can still be sold. An expired batch counted here made a
  // product look available while every sale of it was refused, and its past
  // date hid the product from the "expiring soon" list entirely.
  const today = baghdadTodayIso();
  const sellable = row.batches.filter((b) => !b.expiryDate || b.expiryDate.toISOString().slice(0, 10) >= today);
  const stock = sellable.reduce((sum, b) => sum + b.quantity, 0);
  const looseSubUnits = sellable.reduce((sum, b) => sum + b.openedSubUnits, 0);
  const nearestExpiry = sellable
    .filter((b) => (b.quantity > 0 || b.openedSubUnits > 0) && b.expiryDate)
    .map((b) => b.expiryDate!)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    unit: row.unit,
    salePrice: toNumber(row.salePrice),
    purchasePrice: toNumber(row.purchasePrice),
    reorderLevel: row.reorderLevel,
    stock,
    looseSubUnits,
    imageFilename: row.imageFilename,
    nearestExpiry: nearestExpiry ? nearestExpiry.toISOString() : null,
    unitsPerPackage: row.unitsPerPackage,
    subUnitName: row.subUnitName,
    subUnitPrice: row.subUnitPrice ? toNumber(row.subUnitPrice) : null,
    activeIngredient: row.activeIngredient,
    dosageForm: row.dosageForm,
    strength: row.strength,
  };
}

function matchesStatus(
  p: ReturnType<typeof present>,
  status?: 'low' | 'expiring' | 'out',
): boolean {
  if (!status) return true;
  if (status === 'out') return p.stock <= 0;
  if (status === 'low') return p.stock > 0 && p.stock <= p.reorderLevel;
  if (status === 'expiring') {
    if (!p.nearestExpiry) return false;
    const days = (new Date(p.nearestExpiry).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= EXPIRY_WARNING_DAYS;
  }
  return true;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function listProducts(options: {
  search?: string;
  status?: 'low' | 'expiring' | 'out' | 'archived';
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const archived = options.status === 'archived';
  const where: Prisma.ProductWhereInput = {
    archivedAt: archived ? { not: null } : null,
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' as const } },
            { barcode: { equals: options.search } },
            { activeIngredient: { contains: options.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const rows = await productWithAggregates(where);
  const presented = rows
    .map(present)
    .filter((p) => archived || matchesStatus(p, options.status as 'low' | 'expiring' | 'out' | undefined));
  presented.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const offset = options.offset ?? 0;
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  return presented.slice(offset, offset + limit);
}

export async function productStats(
  search?: string,
): Promise<{ total: number; low: number; expiring: number; out: number }> {
  const where: Prisma.ProductWhereInput = {
    archivedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { barcode: { equals: search } },
          ],
        }
      : {}),
  };
  const rows = (await productWithAggregates(where)).map(present);

  return {
    total: rows.length,
    low: rows.filter((p) => matchesStatus(p, 'low')).length,
    expiring: rows.filter((p) => matchesStatus(p, 'expiring')).length,
    out: rows.filter((p) => matchesStatus(p, 'out')).length,
  };
}

/** One product by id — callers used to page through the (capped) list and missed anything past the first page. */
export async function findById(id: number): Promise<Product | null> {
  const rows = await productWithAggregates({ id });
  return rows[0] ? present(rows[0]) : null;
}

/** Barcode scanner lookup — an exact match, used by the POS screen. */
export async function findByBarcode(barcode: string): Promise<Product | null> {
  const rows = await productWithAggregates({ barcode, archivedAt: null });
  return rows[0] ? present(rows[0]) : null;
}

export async function productIngredients(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { activeIngredient: { not: null }, archivedAt: null },
    select: { activeIngredient: true },
    distinct: ['activeIngredient'],
    orderBy: { activeIngredient: 'asc' },
  });
  return rows.map((r) => r.activeIngredient!).filter(Boolean);
}

/** In-stock products sharing this one's active ingredient — a stand-in when it's sold out. */
export async function productAlternatives(id: number): Promise<ProductAlternative[]> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product?.activeIngredient) return [];

  const rows = await productWithAggregates({
    activeIngredient: { equals: product.activeIngredient, mode: 'insensitive' },
    id: { not: id },
    archivedAt: null,
  });
  return rows
    .map(present)
    .filter((p) => p.stock > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      salePrice: p.salePrice,
      stock: p.stock,
      unit: p.unit,
    }));
}

/**
 * Names the product that already holds this barcode — the bare unique-index
 * error ("هذه القيمة مستخدمة بالفعل") left the pharmacist guessing which one.
 */
async function assertBarcodeFree(barcode: string | null | undefined, ownId?: number) {
  if (!barcode) return;
  const holder = await prisma.product.findUnique({ where: { barcode }, select: { id: true, name: true } });
  if (holder && holder.id !== ownId) {
    throw new AppError(409, `هذا الباركود مستخدم للصنف «${holder.name}»`);
  }
}

/** A fresh internal barcode no product has yet; the unique index still guards the rare race between two tills. */
export async function newUniqueBarcode(random: () => number = Math.random): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = internalBarcode(random);
    if (!(await prisma.product.findUnique({ where: { barcode: code }, select: { id: true } }))) return code;
  }
  throw new AppError(503, 'تعذّر توليد باركود فريد — أعد المحاولة');
}

export async function createProduct(data: ProductCreateData): Promise<Product> {
  await assertBarcodeFree(data.barcode);
  const row = await prisma.product.create({ data });
  const rows = await productWithAggregates({ id: row.id });
  return present(rows[0]);
}

export async function updateProduct(id: number, data: ProductUpdateData): Promise<Product> {
  await assertBarcodeFree(data.barcode as string | null | undefined, id);
  await prisma.product.update({ where: { id }, data });
  const rows = await productWithAggregates({ id });
  return present(rows[0]);
}

/** Thrown by every path that would put new stock in or take stock out. */
export const ARCHIVED_MESSAGE = 'هذا الصنف مؤرشف — استرجعه من «المؤرشفة» في المخزون أولاً';

/**
 * Removes a product from the shelf. With no invoice pointing at it, it is
 * really deleted; once a sale or purchase references it, deleting would
 * rewrite old invoices and reports, so it is archived instead — hidden from
 * every operational screen, history intact, restorable. Its barcode is
 * released so the same medicine can be added again later.
 */
export async function archiveOrDeleteProduct(id: number): Promise<{ archived: boolean }> {
  const [soldCount, purchasedCount] = await Promise.all([
    prisma.saleItem.count({ where: { productId: id } }),
    prisma.purchaseItem.count({ where: { productId: id } }),
  ]);
  if (soldCount === 0 && purchasedCount === 0) {
    await prisma.product.delete({ where: { id } });
    return { archived: false };
  }
  await prisma.product.update({ where: { id }, data: { archivedAt: new Date(), barcode: null } });
  return { archived: true };
}

export async function restoreProduct(id: number): Promise<Product> {
  await prisma.product.update({ where: { id }, data: { archivedAt: null } });
  const rows = await productWithAggregates({ id });
  return present(rows[0]);
}
