import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printBarcodeLabel, printReceipt } from './printer.js';
import { settingsStore } from './settings-store.js';
import { getMachineId } from './license.js';
import { licenseStore } from './licenseStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** Where this till's synced copy of the server's logo lives, for printing without a live network round-trip. */
function logoCachePath(): string {
  return path.join(app.getPath('userData'), 'logo-cache.png');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Nothing flashes an empty white window before React has anything to paint.
  win.once('ready-to-show', () => win.show());

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('print-receipt', async (_event, receipt) => {
  const settings = settingsStore.getAll();
  if (!settings.printerPath) {
    throw new Error('لم يُضبط منفذ الطابعة بعد — افتح الإعدادات');
  }
  const hasLogo = await fs
    .stat(logoCachePath())
    .then(() => true)
    .catch(() => false);
  // The pharmacy's own name/address/phone live here, not in the request —
  // a machine setting, read fresh at print time so changing it in Settings
  // takes effect on the very next receipt with no other wiring.
  await printReceipt(
    settings.printerPath,
    receipt,
    {
      pharmacyName: settings.pharmacyName,
      pharmacyAddress: settings.pharmacyAddress,
      pharmacyPhone: settings.pharmacyPhone,
    },
    hasLogo ? logoCachePath() : null,
  );
});

ipcMain.handle('print-barcode-label', async (_event, label: { barcode: string; productName: string }) => {
  const settings = settingsStore.getAll();
  if (!settings.printerPath) {
    throw new Error('لم يُضبط منفذ الطابعة بعد — افتح الإعدادات');
  }
  await printBarcodeLabel(settings.printerPath, label);
});

/**
 * Refreshes this till's local logo cache from the server, but only when the
 * version has actually changed — printing needs a file on this machine's own
 * disk (no reliable network round-trip mid-print), so the renderer's live
 * `/uploads/pharmacy/logo.png` is mirrored here ahead of time instead.
 */
ipcMain.handle(
  'logo:sync',
  async (_event, { serverUrl, updatedAt }: { serverUrl: string; updatedAt: string | null }) => {
    if (updatedAt === settingsStore.get('logoCachedVersion')) return;

    if (!updatedAt) {
      await fs.unlink(logoCachePath()).catch(() => {});
      settingsStore.set('logoCachedVersion', null);
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/uploads/pharmacy/logo.png`);
      if (!res.ok) return;
      await fs.writeFile(logoCachePath(), Buffer.from(await res.arrayBuffer()));
      settingsStore.set('logoCachedVersion', updatedAt);
    } catch {
      // Offline or the server is unreachable right now — keep whatever is
      // already cached rather than surfacing an error for a background sync.
    }
  },
);

ipcMain.handle('settings:get', () => settingsStore.getAll());
ipcMain.handle('settings:set', (_event, patch: Partial<ReturnType<typeof settingsStore.getAll>>) => {
  settingsStore.setMany(patch);
});

/** A native "Save As" dialog — used for downloading a backup file onto a USB drive or another folder, not just the server's own disk. */
ipcMain.handle(
  'save-file',
  async (_event, { suggestedName, data }: { suggestedName: string; data: ArrayBuffer }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: suggestedName });
    if (canceled || !filePath) return;
    await fs.writeFile(filePath, Buffer.from(data));
  },
);

ipcMain.handle('license:getMachineId', () => getMachineId());
ipcMain.handle('license:getStatus', () => licenseStore.getStatus());
ipcMain.handle('license:activate', (_event, key: string) => licenseStore.activate(key));
