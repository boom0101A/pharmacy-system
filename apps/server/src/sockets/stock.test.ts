import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { signCaptureToken, signToken } from '../middleware/auth.js';
import { broadcastStockChanged, initStockSocket } from './stock.js';

let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer();
  initStockSocket(server);
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

/** Resolves 'connected' or the server's rejection message. */
function tryConnect(token?: string): Promise<{ result: string; socket: Socket }> {
  const socket = connect(url, { auth: token ? { token } : {}, reconnection: false, transports: ['websocket'] });
  return new Promise((resolve) => {
    socket.on('connect', () => resolve({ result: 'connected', socket }));
    socket.on('connect_error', (err) => resolve({ result: err.message, socket }));
  });
}

async function activeUser(isActive = true) {
  return prisma.user.create({
    data: { name: 'كاشير', username: `s-${Math.random()}`, passwordHash: 'x', role: 'cashier', isActive },
  });
}

describe('stock socket authentication', () => {
  it('turns away a connection with no token', async () => {
    const { result, socket } = await tryConnect();
    socket.close();
    expect(result).not.toBe('connected');
  });

  it('turns away a scoped phone-capture token', async () => {
    const { result, socket } = await tryConnect(signCaptureToken(1));
    socket.close();
    expect(result).not.toBe('connected');
  });

  it('turns away a disabled account', async () => {
    const user = await activeUser(false);
    const { result, socket } = await tryConnect(signToken({ userId: user.id, role: 'cashier' }));
    socket.close();
    expect(result).not.toBe('connected');
  });

  it('lets a signed-in till in and delivers stock changes to it', async () => {
    const user = await activeUser();
    const { result, socket } = await tryConnect(signToken({ userId: user.id, role: 'cashier' }));
    expect(result).toBe('connected');

    const received = new Promise((r) => socket.once('stock:changed', r));
    broadcastStockChanged([7]);
    expect(await received).toEqual({ productIds: [7] });
    socket.close();
  });
});
