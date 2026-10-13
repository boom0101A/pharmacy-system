import { describe, expect, it } from 'vitest';
import { isAllowedPrinterPath, isLoopbackUrl, sanitizeSettingsPatch } from './ipcValidation.js';

describe('isAllowedPrinterPath', () => {
  it.each(['COM3', 'LPT1', '\\\\.\\COM4', '\\\\localhost\\POS80', 'tcp://192.168.1.50:9100', 'printer:POS-80', '/dev/usb/lp0'])(
    'accepts a real printer address: %s',
    (value) => expect(isAllowedPrinterPath(value)).toBe(true),
  );

  it.each([
    'C:\\Users\\x\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\x.bat',
    'D:/evil.txt',
    'evil.bat',
    '..\\..\\x',
  ])('rejects a plain file path that would turn printing into an arbitrary file write: %s', (value) =>
    expect(isAllowedPrinterPath(value)).toBe(false),
  );
});

describe('sanitizeSettingsPatch', () => {
  it('keeps known keys with the right types', () => {
    expect(sanitizeSettingsPatch({ pharmacyName: 'صيدلية', serverMode: 'remote', printerPath: 'COM3' })).toEqual({
      pharmacyName: 'صيدلية',
      serverMode: 'remote',
      printerPath: 'COM3',
    });
  });

  it('drops unknown keys, wrong types, invalid serverMode values and unsafe printer paths', () => {
    expect(
      sanitizeSettingsPatch({ evil: 1, pharmacyName: 42, serverMode: 'hacked', printerPath: 'C:\\x.bat' }),
    ).toEqual({});
  });

  it('allows null to clear a nullable field', () => {
    expect(sanitizeSettingsPatch({ printerPath: null })).toEqual({ printerPath: null });
  });
});

describe('isLoopbackUrl', () => {
  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('accepts %s', (u) =>
    expect(isLoopbackUrl(u)).toBe(true),
  );
  it.each(['http://192.168.1.10:3000', 'http://evil.example', 'file:///C:/x', 'not a url'])('rejects %s', (u) =>
    expect(isLoopbackUrl(u)).toBe(false),
  );
});
