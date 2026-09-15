#!/usr/bin/env node
/**
 * `tsc -b` only emits JavaScript — it ignores everything else. The phone
 * capture page (public/capture) is plain HTML/CSS/JS served by app.ts, so
 * without this step it is simply absent from dist/ and the "التقاط بالهاتف"
 * feature 404s in every built copy while working fine in development.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(serverRoot, 'public');
const dest = path.join(serverRoot, 'dist', 'public');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`copied ${path.relative(serverRoot, src)} -> ${path.relative(serverRoot, dest)}`);
