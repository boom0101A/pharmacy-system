import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma.js';
import { seedDefaultAccounts } from './seed.js';

describe('seedDefaultAccounts', () => {
  it('creates the documented admin and cashier accounts on an empty database', async () => {
    await seedDefaultAccounts();

    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    expect(admin?.role).toBe('admin');
    expect(admin?.isActive).toBe(true);
    expect(await bcrypt.compare('admin123', admin!.passwordHash)).toBe(true);

    const cashier = await prisma.user.findUnique({ where: { username: 'cashier' } });
    expect(cashier?.role).toBe('cashier');
    expect(cashier?.isActive).toBe(true);
    expect(await bcrypt.compare('cashier123', cashier!.passwordHash)).toBe(true);
  });

  it('flags both well-known default passwords to be changed on first login', async () => {
    await seedDefaultAccounts();

    const users = await prisma.user.findMany();
    expect(users.map((u) => u.mustChangePassword)).toEqual([true, true]);
  });

  it('never overwrites a real password already set for an existing admin account', async () => {
    const realHash = await bcrypt.hash('a-real-changed-password', 10);
    await prisma.user.create({
      data: { name: 'مدير حقيقي', username: 'admin', passwordHash: realHash, role: 'admin' },
    });

    await seedDefaultAccounts();

    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    expect(admin?.passwordHash).toBe(realHash);
  });

  it('does not bring back the well-known default admin once the owner has replaced it with their own account', async () => {
    await prisma.user.create({
      data: { name: 'علي', username: 'ali', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });

    await seedDefaultAccounts();

    expect(await prisma.user.findUnique({ where: { username: 'admin' } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { username: 'cashier' } })).toBeNull();
  });

  it('is safe to run twice in a row without error or duplicate rows', async () => {
    await seedDefaultAccounts();
    await seedDefaultAccounts();

    const admins = await prisma.user.findMany({ where: { username: 'admin' } });
    const cashiers = await prisma.user.findMany({ where: { username: 'cashier' } });
    expect(admins).toHaveLength(1);
    expect(cashiers).toHaveLength(1);
  });
});
