/**
 * Runs once per test file, before that file's own imports execute (vitest's
 * `setupFiles` guarantee) — this is what makes it safe to point every test at
 * a real, disposable database instead of mocking Prisma.
 */
import 'dotenv/config';
import { afterAll, beforeEach } from 'vitest';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST غير مضبوط في apps/server/.env — راجع قسم "الاختبارات" في README',
  );
}

// Every module a test file imports (services, routes, prisma.ts itself) reads
// DATABASE_URL at import time — overriding it here, before any of that has
// happened yet, is what redirects the whole suite at pharmacy_test instead
// of the real development database.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';

const { prisma } = await import('./src/prisma.js');

const TABLES = [
  'return_items', 'returns', 'sale_items', 'sales',
  'purchase_items', 'purchases', 'batches', 'products',
  'suppliers', 'categories', 'users',
] as const;

/** Every test starts from a genuinely empty database — RESTART IDENTITY so a fixture's id in one test never depends on how many rows a previous test happened to leave behind. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
