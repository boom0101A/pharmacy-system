import os from 'node:os';
import type { Request } from 'express';
import { config } from '../config.js';

/**
 * The origin a phone on the same LAN can actually reach — `req`'s own Host
 * header is the till's `localhost:3000`, useless once printed into a QR code
 * for a different device to scan.
 */
export function lanOrigin(_req: Request): string {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return `http://${entry.address}:${config.port}`;
      }
    }
  }
  return `http://localhost:${config.port}`;
}
