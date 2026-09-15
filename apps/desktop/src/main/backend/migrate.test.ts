import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyPendingMigrations, type MigrationTarget } from './migrate.js';

let dir: string;

/** Records what was run, in order, standing in for the bundled database. */
function fakeTarget(alreadyApplied: string[] = []): MigrationTarget & { ran: { name: string; sql: string }[] } {
  const ran: { name: string; sql: string }[] = [];
  return {
    ran,
    async appliedMigrationNames() {
      return alreadyApplied;
    },
    async apply(name, sql) {
      ran.push({ name, sql });
    },
  };
}

function writeMigration(name: string, sql: string) {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(path.join(dir, name, 'migration.sql'), sql);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('applyPendingMigrations', () => {
  it('applies migrations oldest first, because later ones alter what earlier ones create', async () => {
    // Written out of order on purpose — ordering must come from the name.
    writeMigration('20260913161913_add_batch_write_offs', 'CREATE TABLE b ();');
    writeMigration('20260913041747_baseline', 'CREATE TABLE a ();');
    const target = fakeTarget();

    await applyPendingMigrations(dir, target);

    expect(target.ran.map((r) => r.name)).toEqual([
      '20260913041747_baseline',
      '20260913161913_add_batch_write_offs',
    ]);
  });

  it('passes the file contents through unchanged', async () => {
    writeMigration('20260913041747_baseline', 'CREATE TABLE "users" ("id" SERIAL);');
    const target = fakeTarget();

    await applyPendingMigrations(dir, target);

    expect(target.ran[0].sql).toBe('CREATE TABLE "users" ("id" SERIAL);');
  });

  it('skips migrations the database already has, so an upgrade never re-creates existing tables', async () => {
    writeMigration('20260913041747_baseline', 'CREATE TABLE a ();');
    writeMigration('20260913161913_add_batch_write_offs', 'CREATE TABLE b ();');
    const target = fakeTarget(['20260913041747_baseline']);

    const applied = await applyPendingMigrations(dir, target);

    expect(applied).toEqual(['20260913161913_add_batch_write_offs']);
    expect(target.ran.map((r) => r.name)).toEqual(['20260913161913_add_batch_write_offs']);
  });

  it('does nothing when the database is already up to date', async () => {
    writeMigration('20260913041747_baseline', 'CREATE TABLE a ();');
    const target = fakeTarget(['20260913041747_baseline']);

    expect(await applyPendingMigrations(dir, target)).toEqual([]);
    expect(target.ran).toEqual([]);
  });

  it('ignores stray files and folders without a migration.sql', async () => {
    writeMigration('20260913041747_baseline', 'CREATE TABLE a ();');
    fs.writeFileSync(path.join(dir, 'migration_lock.toml'), 'provider = "postgresql"');
    fs.mkdirSync(path.join(dir, 'not_a_migration'));

    const target = fakeTarget();
    await applyPendingMigrations(dir, target);

    expect(target.ran.map((r) => r.name)).toEqual(['20260913041747_baseline']);
  });

  it('fails loudly when the migrations folder is missing rather than leaving an empty database', async () => {
    await expect(applyPendingMigrations(path.join(dir, 'nope'), fakeTarget())).rejects.toThrow();
  });
});
