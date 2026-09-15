import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Whether a module is the process's own entry point, as opposed to having
 * been imported by something else.
 *
 * The obvious `import.meta.url === pathToFileURL(process.argv[1]).href` is
 * wrong once the code is bundled: a bundler inlines the module into the
 * bundle, so `import.meta.url` becomes the *bundle's* url — and argv[1] is
 * that same bundle. Every "only when run directly" block then fires inside
 * the bundle, in parallel with whatever imported it.
 *
 * Passing the module's own expected file name closes that: an inlined module
 * reports the bundle's name, which never matches.
 */
export function isDirectCliRun(
  moduleUrl: string,
  entryPath: string | undefined,
  expectedModuleName: string,
): boolean {
  if (!entryPath) return false;
  if (moduleUrl !== pathToFileURL(entryPath).href) return false;

  const actualName = path.basename(fileURLToPath(moduleUrl)).replace(/\.[^.]+$/, '');
  return actualName === expectedModuleName;
}
