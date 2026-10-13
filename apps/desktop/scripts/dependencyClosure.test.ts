import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs build script, no type declarations
import { collectDependencyClosure } from './dependencyClosure.mjs';

function pkg(dir: string, name: string, deps: Record<string, string> = {}, optional: Record<string, string> = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', dependencies: deps, optionalDependencies: optional }),
  );
}

describe('collectDependencyClosure', () => {
  it('includes dependencies hoisted to the root, skips nested ones, ignores absent optional ones, and survives cycles', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-'));
    const nm = path.join(root, 'node_modules');
    // sharp → detect-libc (hoisted), semver (nested inside sharp), @img/colour (hoisted, scoped),
    //         @img/sharp-linux (optional, not installed)
    pkg(path.join(nm, 'sharp'), 'sharp', { 'detect-libc': '^2', semver: '^7', '@img/colour': '^1' }, { '@img/sharp-linux': '1' });
    pkg(path.join(nm, 'sharp', 'node_modules', 'semver'), 'semver');
    pkg(path.join(nm, 'detect-libc'), 'detect-libc', { cyclic: '1' });
    pkg(path.join(nm, 'cyclic'), 'cyclic', { 'detect-libc': '2' });
    pkg(path.join(nm, '@img', 'colour'), '@img/colour');

    const result = collectDependencyClosure(['sharp'], nm);

    expect([...result].sort()).toEqual(['@img/colour', 'cyclic', 'detect-libc', 'sharp']);
  });

  it('throws a clear error when a required dependency is missing entirely', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-missing-'));
    const nm = path.join(root, 'node_modules');
    pkg(path.join(nm, 'a'), 'a', { ghost: '1' });

    expect(() => collectDependencyClosure(['a'], nm)).toThrow('ghost');
  });
});
