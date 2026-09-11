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
});
