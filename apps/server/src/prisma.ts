import { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export const prisma = new PrismaClient();

/** Prisma returns Decimal fields as Decimal.js instances — this turns one back into the plain number the rest of the app works with. */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}
