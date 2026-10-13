import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-atomic-'));

vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }));
vi.mock('./license.js', () => ({
  getMachineId: () => 'MACHINE',
  verifyLicenseKey: () => ({
    valid: true,
    payload: { licenseId: '1', licensedTo: 'صيدلية', machineId: 'MACHINE', issuedAt: '2026-01-01', expiresAt: null },
  }),
}));

import { licenseStore } from './licenseStore.js';

describe('licenseStore.activate write', () => {
  it('writes license.json through a temp file and rename, so a power cut cannot leave it half-written', () => {
    const renameSpy = vi.spyOn(fs, 'renameSync');

    licenseStore.activate('KEY');

    expect(renameSpy).toHaveBeenCalledWith(expect.any(String), path.join(userDataDir, 'license.json'));
    expect(JSON.parse(fs.readFileSync(path.join(userDataDir, 'license.json'), 'utf8'))).toEqual({ key: 'KEY' });
    renameSpy.mockRestore();
  });
});
