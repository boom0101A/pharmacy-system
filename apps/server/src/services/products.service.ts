import type { Product, ProductAlternative } from '@pharmacy/shared-types';
import { Prisma } from '@prisma/client';
import { prisma, toNumber } from '../prisma.js';

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
  const stock = row.batches.reduce((sum, b) => sum + b.quantity, 0);
  const nearestExpiry = row.batches
    .filter((b) => b.quantity > 0 && b.expiryDate)
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
    imageFilename: row.imageFilename,
    nearestExpiry: nearestExpiry ? nearestExpiry.toISOString() : null,
    unitsPerPackage: row.unitsPerPackage,
    subUnitName: row.subUnitName,
    subUnitPrice: row.subUnitPrice ? toNumber(row.subUnitPrice) : null,
    activeIngredient: row.activeIngredient,
    dosageForm: row.dosageForm,
    strength: row.strength,
    isActive: true,
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
  status?: 'low' | 'expiring' | 'out';
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const where = options.search
    ? {
        OR: [
          { name: { contains: options.search, mode: 'insensitive' as const } },
          { barcode: { equals: options.search } },
          { activeIngredient: { contains: options.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const rows = await productWithAggregates(where);
  const presented = rows.map(present).filter((p) => matchesStatus(p, options.status));
  presented.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const offset = options.offset ?? 0;
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  return presented.slice(offset, offset + limit);
}

export async function productStats(
  search?: string,
): Promise<{ total: number; low: number; expiring: number; out: number }> {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { barcode: { equals: search } },
        ],
      }
    : undefined;
  const rows = (await productWithAggregates(where)).map(present);

  return {
    total: rows.length,
    low: rows.filter((p) => matchesStatus(p, 'low')).length,
    expiring: rows.filter((p) => matchesStatus(p, 'expiring')).length,
    out: rows.filter((p) => matchesStatus(p, 'out')).length,
  };
}

/** Barcode scanner lookup — an exact match, used by the POS screen. */
export async function findByBarcode(barcode: string): Promise<Product | null> {
  const rows = await productWithAggregates({ barcode });
  return rows[0] ? present(rows[0]) : null;
}

export async function productIngredients(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { activeIngredient: { not: null } },
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

export async function createProduct(data: ProductCreateData): Promise<Product> {
  const row = await prisma.product.create({ data });
  const rows = await productWithAggregates({ id: row.id });
  return present(rows[0]);
}

export async function updateProduct(id: number, data: ProductUpdateData): Promise<Product> {
  await prisma.product.update({ where: { id }, data });
  const rows = await productWithAggregates({ id });
  return present(rows[0]);
}
