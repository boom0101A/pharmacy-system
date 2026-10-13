import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { config } from '../../config.js';
import { signToken } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errors.js';
import { resetPasswordWithToken } from '../passwordReset.service.js';

function resetToken(username: string, secret = config.jwtSecret, expiresIn: jwt.SignOptions['expiresIn'] = 300) {
  return jwt.sign({ scope: 'password-reset', username }, secret, { expiresIn });
}

async function seedUser(isActive = true, role: 'admin' | 'cashier' = 'admin') {
  return prisma.user.create({
    data: {
      name: 'مدير',
      username: `u-${Date.now()}-${Math.random()}`,
      passwordHash: await bcrypt.hash('old-pass', 4),
      role,
      isActive,
    },
  });
}

describe('resetPasswordWithToken', () => {
  it('replaces the password so only the new one works afterwards', async () => {
    const user = await seedUser();

    await resetPasswordWithToken(resetToken(user.username), 'new-pass');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare('new-pass', after.passwordHash)).toBe(true);
    expect(await bcrypt.compare('old-pass', after.passwordHash)).toBe(false);
  });

  it('re-activates a disabled admin, so the whole system can never stay locked out', async () => {
    const user = await seedUser(false, 'admin');
    await resetPasswordWithToken(resetToken(user.username), 'new-pass');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(true);
  });

  it('leaves a disabled non-admin disabled — re-enabling them is the admin\'s decision', async () => {
    const user = await seedUser(false, 'cashier');
    await resetPasswordWithToken(resetToken(user.username), 'new-pass');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(false);
  });

  it('rejects an ordinary login token', async () => {
    const user = await seedUser();
    const session = signToken({ userId: user.id, role: user.role });
    await expect(resetPasswordWithToken(session, 'new-pass')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a token signed with a different secret', async () => {
    const user = await seedUser();
    const forged = resetToken(user.username, 'x'.repeat(64));
    await expect(resetPasswordWithToken(forged, 'new-pass')).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an expired token', async () => {
    const user = await seedUser();
    const expired = jwt.sign(
      { scope: 'password-reset', username: user.username, exp: Math.floor(Date.now() / 1000) - 10 },
      config.jwtSecret,
    );
    await expect(resetPasswordWithToken(expired, 'new-pass')).rejects.toBeInstanceOf(AppError);
  });

  it('reports an unknown username as 404', async () => {
    await expect(resetPasswordWithToken(resetToken('no-such-user'), 'new-pass')).rejects.toMatchObject({
      status: 404,
    });
  });
});
