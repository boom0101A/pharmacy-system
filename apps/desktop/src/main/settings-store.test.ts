import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData: string;

vi.mock('electron', () => ({
  app: { getPath: () => userData },
}));

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-'));
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('settingsStore.serverMode', () => {
  it('defaults to local, so a fresh install runs its own bundled server', async () => {
    const { settingsStore } = await import('./settings-store.js');
    expect(settingsStore.get('serverMode')).toBe('local');
  });

  it('remembers being switched to remote, so a till pointed at another computer stops starting its own', async () => {
    const { settingsStore } = await import('./settings-store.js');

    settingsStore.set('serverMode', 'remote');

    expect(settingsStore.get('serverMode')).toBe('remote');
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).serverMode).toBe('remote');
  });

  it('leaves the existing settings untouched when the mode changes', async () => {
    const { settingsStore } = await import('./settings-store.js');
    settingsStore.set('pharmacyName', 'صيدلية النور');

    settingsStore.set('serverMode', 'remote');

    expect(settingsStore.get('pharmacyName')).toBe('صيدلية النور');
  });

  it('writes via a temp-file-then-rename, so a crash mid-write cannot leave settings.json half-written', async () => {
    const { settingsStore } = await import('./settings-store.js');
    const realRename = fs.renameSync;
    const renamedFrom: string[] = [];
    fs.renameSync = ((from: string, to: string) => {
      renamedFrom.push(from);
      return realRename(from, to);
    }) as typeof fs.renameSync;

    try {
      settingsStore.set('pharmacyName', 'صيدلية الأمل');
    } finally {
      fs.renameSync = realRename;
    }

    // A plain writeFileSync would never call renameSync at all — this is
    // what actually distinguishes "atomic" from the old truncate-in-place.
    expect(renamedFrom).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).pharmacyName).toBe(
      'صيدلية الأمل',
    );
  });
});
