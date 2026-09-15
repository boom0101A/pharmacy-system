import fs from 'node:fs';
import path from 'node:path';

/** The database side of a migration run, kept behind an interface so the ordering and skipping logic is testable without a live server. */
export interface MigrationTarget {
  /** Names already recorded as applied, in any order. */
  appliedMigrationNames(): Promise<string[]>;
  /** Runs one migration's SQL and records its name, atomically. */
  apply(name: string, sql: string): Promise<void>;
}

interface PendingMigration {
  name: string;
  sql: string;
}

/**
 * Applies Prisma's own migration SQL files directly.
 *
 * The Prisma CLI is not shipped with the installer — it and its schema engine
 * would add tens of megabytes to carry a tool the client never invokes. The
 * migration files are plain SQL and this app owns its bundled database from
 * the moment it is created, so replaying them in order is equivalent to
 * `prisma migrate deploy` for this one-way, never-branching history.
 */
export async function applyPendingMigrations(
  migrationsDir: string,
  target: MigrationTarget,
): Promise<string[]> {
  const pending = readMigrations(migrationsDir);
  const applied = new Set(await target.appliedMigrationNames());

  const ranNow: string[] = [];
  for (const migration of pending) {
    if (applied.has(migration.name)) continue;
    await target.apply(migration.name, migration.sql);
    ranNow.push(migration.name);
  }
  return ranNow;
}

function readMigrations(migrationsDir: string): PendingMigration[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  } catch (err) {
    // Silently ending up with an empty database would surface much later as
    // baffling "table does not exist" errors during a sale.
    throw new Error(`مجلّد الترحيلات غير موجود: ${migrationsDir}`, { cause: err });
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      file: path.join(migrationsDir, entry.name, 'migration.sql'),
    }))
    .filter((candidate) => fs.existsSync(candidate.file))
    // Prisma names every folder with a leading timestamp, so plain
    // lexicographic order is chronological order.
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((candidate) => ({ name: candidate.name, sql: fs.readFileSync(candidate.file, 'utf8') }));
}
