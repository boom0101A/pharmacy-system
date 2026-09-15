import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { writeFileAtomic } from './backend/atomicWrite.js';

export interface Settings {
  printerPath: string | null;
  /** Printed on the receipt header instead of the generic app name — the customer's actual pharmacy, not "نظام إدارة الصيدلية". */
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  pharmacyPhone: string | null;
  /** The server's logo `updatedAt` last cached to disk here (see logo:sync in main.ts) — null means either no logo has ever synced, or the server has none. */
  logoCachedVersion: string | null;
  /**
   * `local` — this machine runs the bundled database and server, and serves
   * any other till on the network. `remote` — another computer does, so
   * starting a second server here would only compete for the same port.
   */
  serverMode: 'local' | 'remote';
}

const DEFAULTS: Settings = {
  printerPath: null,
  pharmacyName: null,
  pharmacyAddress: null,
  pharmacyPhone: null,
  logoCachedVersion: null,
  // A fresh install is a complete system on its own — that is the entire
  // point of shipping the database inside the installer.
  serverMode: 'local',
};

/**
 * A plain JSON file under Electron's userData folder — deliberately not
 * `electron-store`: that package reads `app.getPath('userData')` at
 * construction time, which is fragile if anything ever imports this module
 * before `app` is fully ready. Reading `app.getPath` lazily, inside each
 * call, sidesteps that ordering entirely.
 */
function filePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readAll(): Settings {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeAll(settings: Settings) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  writeFileAtomic(filePath(), JSON.stringify(settings, null, 2));
}

export const settingsStore = {
  getAll(): Settings {
    return readAll();
  },
  setMany(patch: Partial<Settings>) {
    writeAll({ ...readAll(), ...patch });
  },
  get<K extends keyof Settings>(key: K): Settings[K] {
    return readAll()[key];
  },
  set<K extends keyof Settings>(key: K, value: Settings[K]) {
    writeAll({ ...readAll(), [key]: value });
  },
};
