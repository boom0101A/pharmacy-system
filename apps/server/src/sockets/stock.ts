import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { verifySessionToken } from '../middleware/auth.js';

let io: SocketServer | null = null;

/** Wires Socket.io onto the same HTTP server so every till hears about stock changes made on any other till. */
export function initStockSocket(server: HttpServer) {
  io = new SocketServer(server, { cors: { origin: '*' } });
  // Anyone on the LAN could otherwise listen in on what is selling.
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown }).token;
    verifySessionToken(typeof token === 'string' ? token : undefined)
      .then((result) => next('error' in result ? new Error(result.error) : undefined))
      .catch((err) => next(err as Error));
  });
}

/** Tells every connected till to refetch these products — a sale, return, or received batch just changed their stock. */
export function broadcastStockChanged(productIds: number[]) {
  if (productIds.length === 0) return;
  io?.emit('stock:changed', { productIds });
}
