import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

/** Wires Socket.io onto the same HTTP server so every till hears about stock changes made on any other till. */
export function initStockSocket(server: HttpServer) {
  io = new SocketServer(server, { cors: { origin: '*' } });
}

/** Tells every connected till to refetch these products — a sale, return, or received batch just changed their stock. */
export function broadcastStockChanged(productIds: number[]) {
  if (productIds.length === 0) return;
  io?.emit('stock:changed', { productIds });
}
