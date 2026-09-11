import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
const DEFAULTS = {
    printerPath: null,
    pharmacyName: null,
    pharmacyAddress: null,
    pharmacyPhone: null,
    logoCachedVersion: null,
};
/**
 * A plain JSON file under Electron's userData folder — deliberately not
 * `electron-store`: that package reads `app.getPath('userData')` at
 * construction time, which is fragile if anything ever imports this module
 * before `app` is fully ready. Reading `app.getPath` lazily, inside each
 * call, sidesteps that ordering entirely.
 */
function filePath() {
    return path.join(app.getPath('userData'), 'settings.json');
}
function readAll() {
    try {
        const raw = fs.readFileSync(filePath(), 'utf8');
        return { ...DEFAULTS, ...JSON.parse(raw) };
    }
    catch {
        return { ...DEFAULTS };
    }
}
function writeAll(settings) {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(settings, null, 2));
}
export const settingsStore = {
    getAll() {
        return readAll();
    },
    setMany(patch) {
        writeAll({ ...readAll(), ...patch });
    },
    get(key) {
        return readAll()[key];
    },
    set(key, value) {
        writeAll({ ...readAll(), [key]: value });
    },
};
