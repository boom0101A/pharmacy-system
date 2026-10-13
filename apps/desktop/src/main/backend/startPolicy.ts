/**
 * An installed copy is a complete system on its own. In development the
 * usual setup is Docker + `npm run dev:server`, which already holds port
 * 3000 — starting a second server there would only collide with it.
 */
export function shouldStartBundledBackend(opts: {
  serverMode: 'local' | 'remote';
  isPackaged: boolean;
  env: NodeJS.ProcessEnv;
}): boolean {
  if (opts.serverMode === 'remote') return false;
  if (opts.isPackaged) return true;
  return opts.env.PHARMACY_BUNDLED_BACKEND === '1';
}
