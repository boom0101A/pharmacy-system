import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-store-test-'));

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
}));

const getMachineId = vi.fn();
vi.mock('./license.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./license.js')>();
  return { ...actual, getMachineId: (...args: unknown[]) => getMachineId(...args) };
});

import { licenseStore } from './licenseStore.js';

describe('licenseStore.getStatus', () => {
  it('degrades to an invalid status instead of throwing when the machine id read fails', () => {
    fs.writeFileSync(path.join(userDataDir, 'license.json'), JSON.stringify({ key: 'anything' }));
    getMachineId.mockImplementation(() => {
      throw new Error('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
    });

    expect(() => licenseStore.getStatus()).not.toThrow();
    expect(licenseStore.getStatus()).toEqual({
      valid: false,
      error: 'تعذّر قراءة معرّف الجهاز من سجل ويندوز',
    });
  });
});

describe('licenseStore.activate', () => {
  it('degrades to an invalid result instead of throwing when the machine id read fails', () => {
    getMachineId.mockImplementation(() => {
      throw new Error('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
    });

    expect(() => licenseStore.activate('some-key')).not.toThrow();
    expect(licenseStore.activate('some-key')).toEqual({
      valid: false,
      error: 'تعذّر قراءة معرّف الجهاز من سجل ويندوز',
    });
  });
});
