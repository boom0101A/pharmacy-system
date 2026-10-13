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

describe('correctedLocalServerUrl', async () => {
  const { correctedLocalServerUrl } = await import('./serverMode');
  const ready = { status: 'ready', serverUrl: 'http://127.0.0.1:3000' } as const;

  it('replaces a mistyped address on this machine with the bundled server that is actually running', () => {
    expect(correctedLocalServerUrl('http://localhost:4000', ready)).toBe('http://127.0.0.1:3000');
  });

  it('leaves an address on another computer alone — that till is deliberately using a remote server', () => {
    expect(correctedLocalServerUrl('http://192.168.1.10:3000', ready)).toBeNull();
  });

  it('does nothing when the stored address already matches', () => {
    expect(correctedLocalServerUrl('http://127.0.0.1:3000', ready)).toBeNull();
  });

  it('does nothing until the bundled server is actually ready', () => {
    expect(correctedLocalServerUrl('http://localhost:4000', { status: 'starting', stage: 'database' })).toBeNull();
  });
});
