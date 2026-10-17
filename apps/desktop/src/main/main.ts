import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printBarcodeLabel, printReceipt } from './printer.js';
import { settingsStore } from './settings-store.js';
import { getMachineId, verifyLicenseKey } from './license.js';
import { resetPassword } from './passwordReset.js';
import { licenseStore } from './licenseStore.js';
import { resolveBackendPaths } from './backend/paths.js';
import { startBundledBackend, type BackendStatus } from './backend/bootstrap.js';
import { stopAllTrackedProcesses } from './backend/processRegistry.js';
import { toErrorMessage } from './backend/errorMessage.js';
import { shouldStartBundledBackend } from './backend/startPolicy.js';
import { isAllowedPrinterPath, sanitizeSettingsPatch } from './ipcValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/** The bundled database's port. Only ever reached over the loopback interface — other tills talk to the Express server, never to Postgres. */
const BUNDLED_DB_PORT = 5433;
/** Matches the app's own default server URL and the address other tills are told to use. */
const SERVER_PORT = 3000;


let backendState: BackendStatus = { status: 'disabled' };
let mainWindow: BrowserWindow | undefined;
let backendStartRequested = false;
let sessionEnding = false;

// A second launch would otherwise race the first for the same database
// cluster, the same port, and the same secrets.json — quit immediately and
// let the first instance carry on.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

/**
 * A startup failure on a client's machine is otherwise invisible — the window
 * just never connects. This file is the first thing to ask for when someone
 * reports "تعذّر الاتصال بالخادم".
 */
function logBootstrap(message: string) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fsSync.mkdirSync(dir, { recursive: true });
    fsSync.appendFileSync(
      path.join(dir, 'bootstrap.log'),
      `${new Date().toISOString()} ${message}\n`,
    );
  } catch {
    // Logging must never be the thing that breaks startup.
  }
}

/**
 * Starts the database and server this installation carries with it, so a
 * fresh machine needs nothing installed beforehand. Skipped when the user has
 * pointed this till at another computer — then that computer is the server.
 */
async function startBackendIfLocal() {
  if (backendStartRequested) return;
  // The licence is enforced here, in the main process, not only by the
  // renderer's activation screen — otherwise an unlicensed copy still ran a
  // fully working server any device on the network could use.
  if (!licenseStore.getStatus().valid) {
    backendState = { status: 'disabled' };
    return;
  }
  if (
    !shouldStartBundledBackend({
      serverMode: settingsStore.get('serverMode'),
      isPackaged: app.isPackaged,
      env: process.env,
    })
  ) {
    backendState = { status: 'disabled' };
    return;
  }

  backendStartRequested = true;
  backendState = { status: 'starting', stage: 'database' };
  logBootstrap(`starting (packaged=${app.isPackaged}, resources=${process.resourcesPath})`);
  try {
    const handle = await startBundledBackend(
      resolveBackendPaths({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        userDataPath: app.getPath('userData'),
        // __dirname is apps/desktop/dist-electron — three levels up is the repo root.
        repoRoot: path.join(__dirname, '..', '..', '..'),
      }),
      process.execPath,
      { dbPort: BUNDLED_DB_PORT, serverPort: SERVER_PORT },
      (stage) => {
        backendState = { status: 'starting', stage };
        logBootstrap(`stage: ${stage}`);
      },
      // The server child's own output is the only place a crash reason (a port
      // conflict, a missing module) ever shows up.
      (line) => logBootstrap(`[server] ${line}`),
      (code) => {
        logBootstrap(`server exited (code ${code})`);
        // Expected while quitting; anything else means every till just lost
        // its server, and the window must say so instead of looking healthy.
        if (!quitting && backendState.status === 'ready') {
          backendState = { status: 'failed', message: `توقف الخادم بشكل غير متوقع (رمز الخروج ${code})` };
        }
      },
    );
    backendState = { status: 'ready', serverUrl: handle.serverUrl };
    logBootstrap('ready');
  } catch (err) {
    backendState = { status: 'failed', message: toErrorMessage(err) };
    logBootstrap(`FAILED: ${err instanceof Error ? err.stack ?? err.message : toErrorMessage(err)}`);
  }
}

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
      // In an installed copy DevTools would let anyone at the till edit the
      // app's state directly — including skipping the licence screen.
      devTools: !app.isPackaged,
    },
    // The minimal menu above stays reachable through its shortcuts without
    // taking a row of the till screen.
    autoHideMenuBar: app.isPackaged,
  });
  mainWindow = win;

  // Only the app itself is ever loaded in this window. A link or injected
  // script must not open a new window (it would inherit the preload, and
  // with it window.pharmacy) or navigate this one away; real web links go to
  // the user's browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = VITE_DEV_SERVER_URL ? url.startsWith(VITE_DEV_SERVER_URL) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });
  // Windows logoff/shutdown: a blocking dialog here would stall the session
  // end until Windows kills the process — and Postgres with it, mid-write.
  win.on('session-end', () => {
    sessionEnding = true;
    void stopAllTrackedProcesses();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = undefined;
  });
  // Closing the only window on the till that hosts the bundled database and
  // server cuts off every other till on the network with no warning — this
  // machine is a server as much as it is a cashier station.
  win.on('close', (event) => {
    if (sessionEnding) return;
    if (BrowserWindow.getAllWindows().length > 1) return;
    if (backendState.status !== 'ready' && backendState.status !== 'starting') return;

    const starting = backendState.status === 'starting';
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['إغلاق', 'إلغاء'],
      defaultId: 1,
      cancelId: 1,
      title: 'تحذير',
      message: starting ? 'جارٍ تهيئة قاعدة البيانات' : 'هذا الجهاز هو الخادم لكل الأجهزة الأخرى على الشبكة',
      detail: starting
        ? 'الإغلاق الآن يقطع التهيئة وستُعاد عند التشغيل التالي. هل تريد الإغلاق؟'
        : 'سيُقطَع الاتصال عن كل الأجهزة الأخرى المتصلة بهذا الجهاز إذا أغلقت التطبيق الآن. هل تريد الإغلاق؟',
    });
    if (choice === 1) event.preventDefault();
  });

  // Nothing flashes an empty white window before React has anything to paint.
  win.once('ready-to-show', () => win.show());

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    // Installed copy: no "Toggle Developer Tools" — but keep the editing and
    // zoom shortcuts. With no menu at all, Ctrl+0 is gone, so a cashier who
    // zoomed by accident (Ctrl+wheel) had no way back short of restarting.
    if (app.isPackaged) {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { role: 'editMenu' },
          { label: 'عرض', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
        ]),
      );
    }
    // The window comes up first and shows the splash while this runs: a first
    // launch has to create a database cluster, which takes tens of seconds, and
    // a blank screen for that long looks like a hang.
    void startBackendIfLocal();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Without this the database keeps running after the app closes, holding its
// port and its data directory lock against the next launch. Unconditional:
// quitting mid-first-run (before startBundledBackend's promise ever settles)
// would otherwise skip cleanup entirely, even though Postgres is already
// tracked and running by that point.
let quitting = false;
app.on('will-quit', (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  stopAllTrackedProcesses().finally(() => app.quit());
});

ipcMain.handle('backend:status', () => backendState);

/** Re-checked at print time too: a value saved before validation existed must not reach the printer library as a file path. */
function assertPrinterPath(printerPath: string) {
  if (!isAllowedPrinterPath(printerPath)) {
    throw new Error('منفذ الطابعة غير صالح — اكتب مثلاً COM3 أو اسم الطابعة المشتركة');
  }
}

ipcMain.handle('print-receipt', async (_event, receipt) => {
  const settings = settingsStore.getAll();
  if (!settings.printerPath) {
    throw new Error('لم يُضبط منفذ الطابعة بعد — افتح الإعدادات');
  }
  assertPrinterPath(settings.printerPath);
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
  assertPrinterPath(settings.printerPath);
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
    if (!/^https?:\/\//i.test(serverUrl)) return;

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
ipcMain.handle('settings:set', (_event, patch: Record<string, unknown>) => {
  const printerPath = patch?.printerPath;
  if (typeof printerPath === 'string' && printerPath.trim() && !isAllowedPrinterPath(printerPath)) {
    throw new Error('منفذ الطابعة غير صالح — اكتب مثلاً COM3 أو printer:اسم الطابعة');
  }
  settingsStore.setMany(sanitizeSettingsPatch(patch ?? {}));
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

/**
 * Read-only on purpose — never loadOrCreateSecrets() here: generating a fresh
 * secret on a till that has none would only produce tokens the real server
 * rejects. Installed: the bundled backend's secrets.json. Development: the
 * JWT_SECRET `npm run dev:server` reads from apps/server/.env.
 */
function readJwtSecret(): string | null {
  if (settingsStore.get('serverMode') === 'remote') return null;
  try {
    if (app.isPackaged) {
      const raw = fsSync.readFileSync(path.join(app.getPath('userData'), 'secrets.json'), 'utf8');
      return (JSON.parse(raw) as { jwtSecret?: string }).jwtSecret ?? null;
    }
    const env = fsSync.readFileSync(path.join(__dirname, '..', '..', 'server', '.env'), 'utf8');
    const match = env.match(/^JWT_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

ipcMain.handle(
  'auth:resetPassword',
  (_event, input: { username: string; licenseKey: string; newPassword: string; serverUrl: string }) =>
    resetPassword(input, {
      isLicenseKeyValid: (key) => {
        try {
          return verifyLicenseKey(key, getMachineId()).valid;
        } catch {
          return false;
        }
      },
      readJwtSecret,
      fetch,
    }),
);

ipcMain.handle('license:getMachineId', () => getMachineId());
ipcMain.handle('license:getStatus', () => licenseStore.getStatus());
ipcMain.handle('license:replace', (_event, key: unknown) =>
  typeof key === 'string' ? licenseStore.replace(key) : { valid: false, error: 'مفتاح غير صالح' },
);
ipcMain.handle('license:activate', (_event, key: string) => {
  const result = licenseStore.activate(key);
  // A first launch starts unlicensed, so the bundled backend was held back
  // until now.
  if (result.valid) void startBackendIfLocal();
  return result;
});
