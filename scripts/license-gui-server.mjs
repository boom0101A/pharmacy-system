#!/usr/bin/env node
/**
 * The no-terminal version of generate-license.mjs: serves a small page at
 * http://127.0.0.1:<PORT>/ with the same three fields, opens the user's
 * default browser to it automatically, and issues the key through the exact
 * same issueLicense() used by the CLI tool. Bound to 127.0.0.1 only — never
 * reachable from the LAN.
 *
 * Exits itself shortly after issuing a key (nothing left running in the
 * background), and also after a long idle timeout in case the page was
 * opened but never submitted.
 */
import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueLicense, LicenseIssueError } from './lib/issue-license.mjs';

const PORT = 4878;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, 'license-gui', 'index.html'), 'utf8');

let idleTimer = setTimeout(() => process.exit(0), IDLE_TIMEOUT_MS);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }

  if (req.method === 'POST' && req.url === '/generate') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, error: 'طلب غير صالح.' });
      return;
    }

    try {
      const { licenseKey, recordPath, payload } = issueLicense(body);
      sendJson(res, 200, { ok: true, licenseKey, recordPath, payload });
      clearTimeout(idleTimer);
      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        error: err instanceof LicenseIssueError ? err.message : `خطأ غير متوقع: ${err.message}`,
      });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  exec(`start "" "http://127.0.0.1:${PORT}"`);
});
