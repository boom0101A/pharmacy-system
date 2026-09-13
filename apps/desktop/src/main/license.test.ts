import { describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();
vi.mock('node:child_process', () => ({ execFileSync: (...args: unknown[]) => execFileSync(...args) }));

import { getMachineId } from './license.js';

describe('getMachineId', () => {
  it('throws a clear Arabic error when the registry read itself fails, not the raw system error', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('spawn reg ENOENT');
    });
    expect(() => getMachineId()).toThrow('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
  });

  it('throws the same clear error when the registry output has no MachineGuid line', () => {
    execFileSync.mockReturnValue('some unrelated output\n');
    expect(() => getMachineId()).toThrow('تعذّر قراءة معرّف الجهاز من سجل ويندوز');
  });

  it('extracts the GUID from a real reg.exe-shaped response', () => {
    execFileSync.mockReturnValue(
      '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n' +
        '    MachineGuid    REG_SZ    ae905ae7-74a1-4929-98d9-f8ddf0d79254\r\n',
    );
    expect(getMachineId()).toBe('ae905ae7-74a1-4929-98d9-f8ddf0d79254');
  });
});
