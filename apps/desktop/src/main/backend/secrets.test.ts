import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOrCreateSecrets } from './secrets.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('loadOrCreateSecrets', () => {
  it('generates a JWT secret the server will actually accept', () => {
    const { jwtSecret } = loadOrCreateSecrets(dir);
    // config.ts refuses to boot below 32 characters, or on the .env.example
    // placeholder — a secret that fails either check kills the whole app.
    expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(jwtSecret).not.toBe('change-me-change-me-change-me-change-me');
  });

  it('generates a database password', () => {
    const { dbPassword } = loadOrCreateSecrets(dir);
    expect(dbPassword.length).toBeGreaterThanOrEqual(16);
  });

  it('returns the same secrets on every later run, so existing sessions and the database keep working', () => {
    const first = loadOrCreateSecrets(dir);
    const second = loadOrCreateSecrets(dir);
    expect(second).toEqual(first);
  });

  it('gives two different installations different secrets', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-'));
    try {
      expect(loadOrCreateSecrets(dir).jwtSecret).not.toBe(loadOrCreateSecrets(other).jwtSecret);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('creates the folder when it does not exist yet', () => {
    const nested = path.join(dir, 'does', 'not', 'exist');
    expect(() => loadOrCreateSecrets(nested)).not.toThrow();
    expect(fs.existsSync(path.join(nested, 'secrets.json'))).toBe(true);
  });

  it('refuses to silently regenerate secrets when the file exists but is corrupt, instead of generating a password that no longer matches the already-created database role', () => {
    // The original bug: any read/parse failure (not just "file doesn't
    // exist") fell through to generating brand-new random secrets. If the
    // database cluster was already created with the OLD password, every
    // future connection then fails SCRAM auth forever — a silent, permanent
    // lockout with no clue in any log about why.
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'secrets.json'), 'not valid json {{{');

    expect(() => loadOrCreateSecrets(dir)).toThrow();
  });

  it('refuses to silently regenerate secrets when the file is missing required fields', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'secrets.json'), JSON.stringify({ jwtSecret: 'only-one-field' }));

    expect(() => loadOrCreateSecrets(dir)).toThrow();
  });

  it('still generates fresh secrets normally when the file genuinely does not exist yet (a real first run)', () => {
    // Distinguishes ENOENT (fine, expected) from every other failure (not
    // fine) — this is the one case that must NOT throw.
    expect(() => loadOrCreateSecrets(dir)).not.toThrow();
  });
});
