/**
 * Without this, @testing-library/react's DOM from one test leaks into the
 * next (it auto-cleans only when it detects a global `afterEach`, which
 * isn't exposed unless vitest's own globals are enabled) — harmless as long
 * as no two tests in the same file ever query for the same text, which is
 * exactly the kind of thing that stops being true the moment a file grows.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
