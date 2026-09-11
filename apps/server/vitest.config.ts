import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Schema migrations and row-locking transactions don't parallelize well
    // against a single shared test database.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
