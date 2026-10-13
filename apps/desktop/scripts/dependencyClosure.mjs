import fs from 'node:fs';
import path from 'node:path';

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

/**
 * Every package that has to sit at the top level of the staged
 * `node_modules` for `packageNames` to load — their dependencies,
 * recursively, resolved the way Node does: a copy nested inside the parent
 * package travels with it, anything else comes from the root.
 *
 * Copying only the listed packages used to miss whatever npm hoisted to the
 * repo root (sharp's `detect-libc`). Inside the repo Node still found it by
 * walking up the folders, so every local test passed — and the installed app
 * crashed on the first start on any other machine.
 */
export function collectDependencyClosure(packageNames, rootModules) {
  const topLevel = new Set();

  function visit(name, packageDir) {
    const manifest = readManifest(packageDir);
    const required = Object.keys(manifest.dependencies ?? {});
    const optional = Object.keys(manifest.optionalDependencies ?? {});

    for (const dep of [...required, ...optional]) {
      const nested = path.join(packageDir, 'node_modules', dep);
      if (fs.existsSync(path.join(nested, 'package.json'))) {
        visit(dep, nested); // travels with its parent; only its own hoisted deps matter
        continue;
      }
      const hoisted = path.join(rootModules, dep);
      if (!fs.existsSync(path.join(hoisted, 'package.json'))) {
        if (optional.includes(dep)) continue; // optional and not installed for this platform
        throw new Error(`"${name}" needs "${dep}", which is not installed in ${rootModules}`);
      }
      if (topLevel.has(dep)) continue;
      topLevel.add(dep);
      visit(dep, hoisted);
    }
  }

  for (const name of packageNames) {
    if (topLevel.has(name)) continue;
    topLevel.add(name);
    visit(name, path.join(rootModules, name));
  }
  return topLevel;
}
