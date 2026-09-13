/**
 * Creates the two default accounts documented in README.md so a freshly
 * migrated, empty database always has a way to log in for the first time.
 *
 * Usage: npm run db:seed --workspace=@pharmacy/server
 */
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/prisma.js';

const DEFAULT_ACCOUNTS = [
  { username: 'admin', password: 'admin123', name: 'مدير النظام', role: 'admin' as const },
  { username: 'cashier', password: 'cashier123', name: 'أمين الصندوق', role: 'cashier' as const },
];

/**
 * Skips any username that already exists instead of touching it — a real
 * client may have already changed a default password, and reseeding must
 * never silently reset it back to the well-known default.
 */
export async function seedDefaultAccounts(): Promise<void> {
  for (const account of DEFAULT_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { username: account.username } });
    if (existing) {
      console.log(`تخطّي: ${account.username} موجود مسبقاً`);
      continue;
    }
    await prisma.user.create({
      data: {
        name: account.name,
        username: account.username,
        passwordHash: await bcrypt.hash(account.password, 10),
        role: account.role,
        isActive: true,
      },
    });
    console.log(`أُنشئ: ${account.username}`);
  }
}

async function main() {
  await seedDefaultAccounts();
}

// Only runs when this file is executed directly (`tsx prisma/seed.ts`) —
// seedDefaultAccounts above is also imported directly by seed.test.ts, which
// must not trigger a second, unwanted CLI run as a side effect of that
// import. Same comparison restore.ts already uses for the same reason.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
