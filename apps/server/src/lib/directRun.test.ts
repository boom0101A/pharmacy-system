import { describe, expect, it } from 'vitest';
import { isDirectCliRun } from './directRun.js';

describe('isDirectCliRun', () => {
  it('is true when the file really is the entry point', () => {
    expect(isDirectCliRun('file:///F:/app/prisma/seed.ts', 'F:\\app\\prisma\\seed.ts', 'seed')).toBe(true);
  });

  it('is true for the compiled file too', () => {
    expect(
      isDirectCliRun('file:///F:/app/dist/prisma/seed.js', 'F:\\app\\dist\\prisma\\seed.js', 'seed'),
    ).toBe(true);
  });

  it('is false when the module was merely imported by something else', () => {
    expect(isDirectCliRun('file:///F:/app/prisma/seed.ts', 'F:\\app\\src\\index.ts', 'seed')).toBe(false);
  });

  it('is false inside a bundle, where the inlined module reports the bundle as its own url', () => {
    // The case a plain url === argv[1] comparison gets wrong: esbuild inlines
    // seed.ts into server.mjs, so both sides become server.mjs and the seed
    // fires a second time in parallel with its caller — two concurrent inserts
    // of the same username, one of which dies on the unique index.
    expect(
      isDirectCliRun(
        'file:///F:/app/resources/server/server.mjs',
        'F:\\app\\resources\\server\\server.mjs',
        'seed',
      ),
    ).toBe(false);
  });

  it('is false when there is no entry argument at all', () => {
    expect(isDirectCliRun('file:///F:/app/prisma/seed.ts', undefined, 'seed')).toBe(false);
  });

  it('handles a path containing spaces, which this project is installed under', () => {
    expect(
      isDirectCliRun('file:///F:/work%202/app/prisma/seed.ts', 'F:\\work 2\\app\\prisma\\seed.ts', 'seed'),
    ).toBe(true);
  });
});
