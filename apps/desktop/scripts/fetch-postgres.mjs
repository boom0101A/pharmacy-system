#!/usr/bin/env node
/**
 * Downloads the official Windows x64 PostgreSQL binaries and trims them down
 * to the smallest set that can still run `initdb`, `postgres` and `pg_ctl`,
 * so the installer can carry its own database engine instead of asking a
 * pharmacy to install PostgreSQL by hand.
 *
 * Idempotent: re-running with vendor/pgsql already populated does nothing.
 *
 *   node scripts/fetch-postgres.mjs          # fetch + trim if missing
 *   node scripts/fetch-postgres.mjs --force  # re-fetch from scratch
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PG_VERSION = '16.4-1';
const URL = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`;

const desktopRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(desktopRoot, 'vendor');
const targetDir = path.join(vendorDir, 'pgsql');
const workDir = path.join(vendorDir, '.pg-download');
const zipPath = path.join(workDir, 'pgsql.zip');

/** Only what a server needs to be created, started and stopped. Everything else — psql, pg_dump, pgAdmin, StackBuilder — is weight the client never runs. */
const KEEP_EXECUTABLES = ['initdb.exe', 'postgres.exe', 'pg_ctl.exe'];

/**
 * PostgreSQL's Windows binaries are built with MSVC and link against these at
 * run time, but the binaries-only archive does not contain them — the official
 * installer pulls in the Visual C++ Redistributable separately. A machine that
 * never had it would fail with "VCRUNTIME140.dll was not found" the moment the
 * database is created, which is exactly the kind of failure a pharmacy cannot
 * diagnose. Windows resolves an executable's own folder first, so shipping
 * them beside postgres.exe removes the dependency entirely. Microsoft licenses
 * these files for redistribution with an application.
 */
const VC_RUNTIME_DLLS = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'];

function ensureVcRuntime(binDir) {
  const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  for (const name of VC_RUNTIME_DLLS) {
    const dest = path.join(binDir, name);
    if (fs.existsSync(dest)) continue;
    const src = path.join(system32, name);
    if (!fs.existsSync(src)) {
      throw new Error(
        `${name} غير موجود في ${system32} — ثبّت Microsoft Visual C++ Redistributable على جهاز البناء`,
      );
    }
    fs.cpSync(src, dest);
    log(`bundled ${name}`);
  }
}

function log(message) {
  console.log(`[fetch-postgres] ${message}`);
}

function dirSizeMb(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return Math.round(total / 1024 / 1024);
}

if (fs.existsSync(targetDir) && !process.argv.includes('--force')) {
  // Still verified on every build: an existing folder from an older run may
  // predate the runtime DLLs being bundled at all.
  ensureVcRuntime(path.join(targetDir, 'bin'));
  log(`already present at vendor/pgsql (${dirSizeMb(targetDir)} MB) — nothing to do`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
if (process.argv.includes('--force')) fs.rmSync(workDir, { recursive: true, force: true });
// Keep any previously downloaded archive: only the extracted tree is rebuilt,
// so a failure after the download never costs another 330 MB transfer.
fs.rmSync(path.join(workDir, 'pgsql'), { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const remoteSize = Number((await fetch(URL, { method: 'HEAD' })).headers.get('content-length') ?? 0);
if (fs.existsSync(zipPath) && fs.statSync(zipPath).size === remoteSize && remoteSize > 0) {
  log('archive already downloaded — skipping');
} else {
log(`downloading PostgreSQL ${PG_VERSION} (about 330 MB, one time only)…`);
// curl rather than fetch(): a 330 MB transfer gets reset often enough that
// resume (-C -) and retries matter, and buffering it all in memory first —
// which fetch().arrayBuffer() would do — is wasteful either way.
execFileSync(
  'curl',
  ['-L', '--fail', '--retry', '5', '--retry-delay', '2', '--retry-connrefused', '-C', '-', '-o', zipPath, URL],
  { stdio: 'inherit' },
);
log(`downloaded ${Math.round(fs.statSync(zipPath).size / 1024 / 1024)} MB`);
}

log('extracting…');
// Windows' own bsdtar, by absolute path on purpose: a Git-for-Windows install
// puts GNU tar first on PATH, and GNU tar cannot read a zip at all.
const bsdtar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(bsdtar, ['-xf', zipPath, '-C', workDir], { stdio: 'inherit' });

const extracted = path.join(workDir, 'pgsql');
if (!fs.existsSync(extracted)) {
  throw new Error(`expected ${extracted} inside the archive`);
}

log('trimming…');
// bin: the three executables plus every DLL they link against.
const binSrc = path.join(extracted, 'bin');
const binDest = path.join(targetDir, 'bin');
fs.mkdirSync(binDest, { recursive: true });
for (const name of fs.readdirSync(binSrc)) {
  const keep = KEEP_EXECUTABLES.includes(name) || name.endsWith('.dll');
  if (keep) fs.cpSync(path.join(binSrc, name), path.join(binDest, name));
}

// lib: loadable modules only. plpgsql is not optional — initdb installs it
// into template1, so a missing plpgsql.dll breaks database creation itself.
const libSrc = path.join(extracted, 'lib');
const libDest = path.join(targetDir, 'lib');
fs.mkdirSync(libDest, { recursive: true });
for (const name of fs.readdirSync(libSrc)) {
  if (name.endsWith('.dll')) fs.cpSync(path.join(libSrc, name), path.join(libDest, name));
}

// share: required wholesale by initdb (postgres.bki, the bootstrap SQL, time
// zone tables and locale data). Trimming inside it breaks database creation.
fs.cpSync(path.join(extracted, 'share'), path.join(targetDir, 'share'), { recursive: true });

ensureVcRuntime(binDest);

fs.rmSync(workDir, { recursive: true, force: true });
log(`done — vendor/pgsql is ${dirSizeMb(targetDir)} MB`);
