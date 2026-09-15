import os from 'node:os';
import type { Request } from 'express';
import { config } from '../config.js';

interface InterfaceEntry {
  family: string;
  internal: boolean;
  address: string;
}

/**
 * The address other machines on the network use to reach this one — what a
 * pharmacy types into its second till, and what goes into the QR code a phone
 * scans. Loopback is useless to both, and IPv6 is impractical to copy by hand.
 */
export function pickLanAddress(
  interfaces: Record<string, InterfaceEntry[] | undefined>,
): string {
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return 'localhost';
}

/**
 * The origin a phone on the same LAN can actually reach — `req`'s own Host
 * header is the till's `localhost:3000`, useless once printed into a QR code
 * for a different device to scan.
 */
export function lanOrigin(_req: Request): string {
  return `http://${pickLanAddress(os.networkInterfaces())}:${config.port}`;
}

/** The same address, for showing the user which server other tills should point at. */
export function lanServerUrl(): string {
  return `http://${pickLanAddress(os.networkInterfaces())}:${config.port}`;
}
