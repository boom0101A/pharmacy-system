#!/usr/bin/env node
/**
 * Stages the backend for packaging: the server as one ESM bundle, plus the
 * handful of packages that cannot be bundled because they carry native
 * binaries (Prisma's query engine and sharp's image codecs).
 *
 * Output: apps/desktop/build-resources/server/
 *   server.mjs          the whole Express/Prisma server
 *   node_modules/…      only the native packages, resolved from there at runtime
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const desktopRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(desktopRoot, '..', '..');
const serverRoot = path.join(repoRoot, 'apps', 'server');
const rootModules = path.join(repoRoot, 'node_modules');
const outDir = path.join(desktopRoot, 'build-resources', 'server');

/**
 * Native packages, shipped as-is next to the bundle. Anything with a .node
 * binary or a platform-specific sub-package has to stay external — esbuild
 * would inline the JavaScript and leave the binary behind.
 */
const NATIVE_PACKAGES = ['@prisma/client', '.prisma', 'sharp', '@img'];

const entry = path.join(serverRoot, 'dist', 'src', 'index.js');
if (!fs.existsSync(entry)) {
  throw new Error(`build the server first: ${entry} is missing`);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  // ESM output keeps `import.meta.url` intact — config.ts, logger.ts and
  // app.ts all resolve their folders through it.
  format: 'esm',
  target: 'node20',
  outfile: path.join(outDir, 'server.mjs'),
  external: ['@prisma/client', '.prisma/*', 'sharp'],
  banner: {
    // express and its dependencies are CommonJS and call require() at load
    // time. An ESM bundle has no require, so esbuild's fallback throws
    // "Dynamic require of \"path\" is not supported" on the very first import
    // — this hands it a real one.
    js: [
      "import { createRequire as __nodeCreateRequire } from 'node:module';",
      'const require = __nodeCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  logLevel: 'info',
});

// The phone capture page. Bundling collapsed the server into one file in a
// new folder, so these assets have to travel with it — PUBLIC_DIR points the
// server back at them.
fs.cpSync(path.join(serverRoot, 'public'), path.join(outDir, 'public'), { recursive: true });

// Prisma leaves `*.tmp<pid>` files behind in `.prisma/client` when a previous
// `generate` ran while something else (a dev server, an editor) held the
// query engine file open on Windows — each one is a second full copy of the
// engine binary, pure dead weight if it ends up inside the installer.
const isPrismaTmpFile = (entry) => /\.tmp\d*$/.test(entry);

const destModules = path.join(outDir, 'node_modules');
for (const pkg of NATIVE_PACKAGES) {
  const from = path.join(rootModules, pkg);
  if (!fs.existsSync(from)) {
    throw new Error(`expected native package at ${from}`);
  }
  fs.cpSync(from, path.join(destModules, pkg), {
    recursive: true,
    filter: (src) => !isPrismaTmpFile(path.basename(src)),
  });
}

// Only the Windows build of sharp's codecs is ever loaded by the installer;
// the Linux and macOS ones are pure weight.
const imgDir = path.join(destModules, '@img');
if (fs.existsSync(imgDir)) {
  for (const name of fs.readdirSync(imgDir)) {
    const platformSpecific = /^sharp-(?!win32-x64)/.test(name) || /^sharp-libvips-(?!win32-x64)/.test(name);
    if (platformSpecific) fs.rmSync(path.join(imgDir, name), { recursive: true, force: true });
  }
}

function sizeMb(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return Math.round(total / 1024 / 1024);
}

console.log(`[bundle-server] staged ${sizeMb(outDir)} MB in build-resources/server`);
