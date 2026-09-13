import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: { entry: 'src/main/main.ts' },
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
