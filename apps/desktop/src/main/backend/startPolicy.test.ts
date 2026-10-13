import { describe, expect, it } from 'vitest';
import { shouldStartBundledBackend } from './startPolicy.js';

describe('shouldStartBundledBackend', () => {
  it('never starts when this till points at another computer', () => {
    expect(shouldStartBundledBackend({ serverMode: 'remote', isPackaged: true, env: {} })).toBe(false);
  });

  it('starts in an installed copy', () => {
    expect(shouldStartBundledBackend({ serverMode: 'local', isPackaged: true, env: {} })).toBe(true);
  });

  it('does not start in development, where `npm run dev:server` already holds port 3000', () => {
    expect(shouldStartBundledBackend({ serverMode: 'local', isPackaged: false, env: {} })).toBe(false);
  });

  it('starts in development only when explicitly opted in', () => {
    expect(
      shouldStartBundledBackend({ serverMode: 'local', isPackaged: false, env: { PHARMACY_BUNDLED_BACKEND: '1' } }),
    ).toBe(true);
  });
});
