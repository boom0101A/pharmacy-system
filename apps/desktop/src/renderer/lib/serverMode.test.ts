import { describe, expect, it } from 'vitest';
import { serverModeForUrl } from './serverMode';

describe('serverModeForUrl', () => {
  it('treats localhost as this machine running its own server', () => {
    expect(serverModeForUrl('http://localhost:3000')).toBe('local');
  });

  it('treats the loopback address the same way', () => {
    expect(serverModeForUrl('http://127.0.0.1:3000')).toBe('local');
  });

  it('treats another computer on the network as remote', () => {
    // That machine is the server; starting a second one here would only fight
    // it for port 3000 and keep a database nobody reads.
    expect(serverModeForUrl('http://192.168.1.10:3000')).toBe('remote');
  });

  it('treats a hostname as remote', () => {
    expect(serverModeForUrl('http://pharmacy-pc:3000')).toBe('remote');
  });

  it('falls back to local for an unparseable address, so a typo never disables the bundled server', () => {
    expect(serverModeForUrl('not a url')).toBe('local');
  });
});
