import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { config } from '../../config.js';
import { app } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { changePassword } from '../auth.service.js';
import { resetPasswordWithToken, PASSWORD_RESET_SCOPE } from '../passwordReset.service.js';

async function makeUser(password: string, mustChangePassword = true) {
  return prisma.user.create({
    data: {
      name: 'مستخدم',
      username: `u-${Date.now()}-${Math.random()}`,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'admin',
      mustChangePassword,
    },
  });
}

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('changePassword', () => {
  it('sets the new password and clears the must-change flag', async () => {
    const user = await makeUser('admin123');

    await changePassword(user.id, 'admin123', 'new-secret');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare('new-secret', after.passwordHash)).toBe(true);
    expect(after.mustChangePassword).toBe(false);
  });

  it('rejects a wrong current password and changes nothing', async () => {
    const user = await makeUser('admin123');

    await expect(changePassword(user.id, 'wrong', 'new-secret')).rejects.toMatchObject({ status: 400 });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBe(user.passwordHash);
    expect(after.mustChangePassword).toBe(true);
  });

  it('refuses to "change" to the very same password', async () => {
    const user = await makeUser('admin123');

    await expect(changePassword(user.id, 'admin123', 'admin123')).rejects.toMatchObject({ status: 400 });
  });
});

describe('must-change flag over HTTP', () => {
  it('login and /me report it', async () => {
    const user = await makeUser('admin123');

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'admin123' }),
    });
    const body = (await login.json()) as { token: string; user: { mustChangePassword: boolean } };
    expect(body.user.mustChangePassword).toBe(true);

    const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${body.token}` } });
    expect(((await me.json()) as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
  });

  it('POST /auth/change-password works for the signed-in user', async () => {
    const user = await makeUser('admin123');
    const token = signToken({ userId: user.id, role: 'admin' });

    const res = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'new-secret' }),
    });

    expect(res.status).toBe(204);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);
  });

  it('a user an admin creates must pick their own password on first login', async () => {
    const admin = await makeUser('x', false);
    const token = signToken({ userId: admin.id, role: 'admin' });

    const res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'جديد', username: `new-${Math.random()}`, password: 'temp1234', role: 'cashier' }),
    });
    const created = (await res.json()) as { mustChangePassword: boolean };

    expect(created.mustChangePassword).toBe(true);
  });

  it('an admin setting someone else\'s password makes them change it again', async () => {
    const admin = await makeUser('x', false);
    const other = await makeUser('old', false);
    const token = signToken({ userId: admin.id, role: 'admin' });

    await fetch(`${base}/users/${other.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'آخر', role: 'cashier', isActive: true, password: 'temp1234' }),
    });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).mustChangePassword).toBe(true);
  });
});

describe('license-key password reset', () => {
  it('counts as choosing your own password', async () => {
    const user = await makeUser('forgotten');
    const token = jwt.sign({ scope: PASSWORD_RESET_SCOPE, username: user.username }, config.jwtSecret);

    await resetPasswordWithToken(token, 'chosen-by-me');

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);
  });
});
