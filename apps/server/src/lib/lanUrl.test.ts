import { describe, expect, it } from 'vitest';
import { pickLanAddress } from './lanUrl.js';

describe('pickLanAddress', () => {
  it('picks the machine address another computer on the network can actually reach', () => {
    const address = pickLanAddress({
      Ethernet: [{ family: 'IPv4', internal: false, address: '192.168.1.10' }],
    });
    expect(address).toBe('192.168.1.10');
  });

  it('skips the loopback interface, which is useless to every other device', () => {
    const address = pickLanAddress({
      Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.0.42' }],
    });
    expect(address).toBe('192.168.0.42');
  });

  it('skips IPv6, since the app addresses are written by hand into a text box', () => {
    const address = pickLanAddress({
      'Wi-Fi': [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv4', internal: false, address: '10.0.0.5' },
      ],
    });
    expect(address).toBe('10.0.0.5');
  });

  it('falls back to localhost on a machine with no network at all', () => {
    expect(pickLanAddress({ Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] })).toBe(
      'localhost',
    );
  });

  it('tolerates an interface entry with no addresses', () => {
    expect(pickLanAddress({ Disconnected: undefined })).toBe('localhost');
  });
});
