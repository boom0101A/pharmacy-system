import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-replace-test-'));
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }));

/** Fake keys: "<machine>|<expiry ISO or 'never'>" — the signature check itself is license.test.ts's job. */
vi.mock('./license.js', () => ({
  getMachineId: () => 'THIS-PC',
  verifyLicenseKey: (key: string, machineId: string) => {
    const [machine, expiry] = key.split('|');
    if (machine !== machineId) return { valid: false, error: 'هذا المفتاح صادر لجهاز آخر' };
    const expiresAt = expiry === 'never' ? null : expiry;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return { valid: false, error: 'انتهت صلاحية هذا المفتاح' };
    return { valid: true, payload: { licenseId: key, licensedTo: 'صيدلية', machineId, issuedAt: '', expiresAt } };
  },
}));

const { licenseStore } = await import('./licenseStore.js');

const inDays = (n: number) => `THIS-PC|${new Date(Date.now() + n * 86_400_000).toISOString()}`;
const PERPETUAL = 'THIS-PC|never';
const stored = () => JSON.parse(fs.readFileSync(path.join(userDataDir, 'license.json'), 'utf8')).key;

describe('licenseStore.replace — renewing before the trial runs out', () => {
  beforeEach(() => {
    licenseStore.activate(inDays(7));
  });

  it('extends a one-week trial to a month', () => {
    const month = inDays(30);
    expect(licenseStore.replace(month).valid).toBe(true);
    expect(stored()).toBe(month);
  });

  it('turns a trial into a perpetual license', () => {
    expect(licenseStore.replace(PERPETUAL).valid).toBe(true);
    expect(stored()).toBe(PERPETUAL);
  });

  it.each([
    ['a shorter key than the current one', () => inDays(2)],
    ['a dated key over a perpetual one', () => (licenseStore.activate(PERPETUAL), inDays(365))],
  ])('refuses %s and keeps the current license', (_label, makeKey) => {
    const key = makeKey();
    const before = stored();

    const result = licenseStore.replace(key);

    expect(result).toEqual({ valid: false, error: expect.stringContaining('أقصر') });
    expect(stored()).toBe(before);
  });

  it('refuses a key issued for another machine', () => {
    const before = stored();
    const result = licenseStore.replace('OTHER-PC|never');
    expect(result.valid).toBe(false);
    expect(stored()).toBe(before);
  });
});
