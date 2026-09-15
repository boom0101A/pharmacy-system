import pg from 'pg';
import type { MigrationTarget } from './migrate.js';

export interface ConnectionSettings {
  user: string;
  password: string;
  port: number;
  database: string;
}

export function buildDatabaseUrl(conn: ConnectionSettings): string {
  const password = encodeURIComponent(conn.password);
  return `postgresql://${conn.user}:${password}@127.0.0.1:${conn.port}/${conn.database}?schema=public`;
}

async function withClient<T>(conn: ConnectionSettings, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    // pg's own default is 0 — wait forever. A stuck/overloaded database or a
    // silently-dropping firewall must fail loudly instead of leaving the
    // whole bootstrap sequence hung with no way to tell it apart from a
    // merely slow one.
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * initdb only creates postgres/template0/template1 — the pharmacy's own
 * database has to be created once, connecting through the built-in `postgres`
 * database to do it.
 */
export async function ensureDatabase(conn: ConnectionSettings): Promise<void> {
  await withClient({ ...conn, database: 'postgres' }, async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [conn.database]);
    if (rowCount === 0) {
      // Identifiers cannot be parameterised; the name is ours, not user input.
      await client.query(`CREATE DATABASE "${conn.database}"`);
    }
  });
}

/**
 * Applies migrations through the same `_prisma_migrations` bookkeeping table
 * Prisma itself uses, so a developer running `prisma migrate status` against a
 * database this created still sees an accurate, non-conflicting history.
 */
export function migrationTarget(conn: ConnectionSettings): MigrationTarget {
  return {
    async appliedMigrationNames() {
      return withClient(conn, async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
            "id" VARCHAR(36) PRIMARY KEY,
            "checksum" VARCHAR(64) NOT NULL,
            "finished_at" TIMESTAMPTZ,
            "migration_name" VARCHAR(255) NOT NULL,
            "logs" TEXT,
            "rolled_back_at" TIMESTAMPTZ,
            "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "applied_steps_count" INTEGER NOT NULL DEFAULT 0
          )
        `);
        const { rows } = await client.query<{ migration_name: string }>(
          'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
        );
        return rows.map((row) => row.migration_name);
      });
    },

    async apply(name, sql) {
      await withClient(conn, async (client) => {
        // One transaction per migration: a half-applied schema is far worse
        // than a failed launch that can simply be retried.
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
             VALUES (gen_random_uuid()::text, '', $1, now(), 1)`,
            [name],
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      });
    },
  };
}
