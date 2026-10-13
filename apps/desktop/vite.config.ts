import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    react(),
    {
      // Build only: Vite's dev server needs inline scripts for hot reload.
      // Scripts may come only from the app itself, so text from the server (a
      // product or supplier name) can never run as code. Images, API and
      // socket traffic must reach whatever LAN address the till is pointed at.
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; connect-src 'self' http: https: ws: wss:; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'" />`,
        ),
    },
    electron({
      main: {
        entry: 'src/main/main.ts',
        // pg@8.15+ ships an ESM wrapper whose CJS internals import it back;
        // bundled together that cycle hits a TDZ ("Cannot access 'pg' before
        // initialization") at startup. Loaded natively from node_modules, it doesn't.
        vite: { build: { rollupOptions: { external: ['pg'] } } },
      },
      preload: { input: 'src/main/preload.ts' },
    }),
  ],
  css: {
    modules: {
      // Readable class names in devtools, still hashed for isolation.
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  server: { port: 5173 },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Vitest's own default `exclude` doesn't know about this project's
    // `tsc -b` output directory (`dist-ts`, per tsconfig's `outDir`) — without
    // this, every *.test.ts file gets picked up a second time as a compiled
    // copy in dist-ts, with import paths that don't resolve the same way,
    // and fails there for reasons that have nothing to do with the actual test.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-ts/**',
      '**/dist-electron/**',
      '**/release/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
