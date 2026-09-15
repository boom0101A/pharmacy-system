import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomic } from './atomicWrite.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeFileAtomic', () => {
  it('writes the file with the given content', () => {
    const file = path.join(dir, 'data.json');
    writeFileAtomic(file, '{"a":1}');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}');
  });

  it('replaces existing content rather than appending', () => {
    const file = path.join(dir, 'data.json');
    writeFileAtomic(file, 'first');
    writeFileAtomic(file, 'second');
    expect(fs.readFileSync(file, 'utf8')).toBe('second');
  });

  it('leaves no temp file behind after a successful write', () => {
    const file = path.join(dir, 'data.json');
    writeFileAtomic(file, 'content');
    const leftovers = fs.readdirSync(dir).filter((name) => name !== 'data.json');
    expect(leftovers).toEqual([]);
  });

  it('never leaves a half-written target file — the write lands as one atomic rename, not an in-place truncate+write', () => {
    // A plain writeFileSync truncates the target before writing new bytes, so
    // a crash mid-write (or, on Windows, antivirus scanning the file at the
    // wrong moment) can leave 0 bytes or a partial JSON document. Verifying
    // this requires proving the *mechanism* (temp file + rename), since a
    // real crash mid-syscall can't be simulated directly: the temp file must
    // exist in the same directory (rename across volumes isn't atomic) and
    // must not be the final path itself.
    const file = path.join(dir, 'data.json');
    const seenTempNames: string[] = [];
    const realRename = fs.renameSync;
    try {
      fs.renameSync = ((from: string, to: string) => {
        seenTempNames.push(from);
        return realRename(from, to);
      }) as typeof fs.renameSync;
      writeFileAtomic(file, 'content');
    } finally {
      fs.renameSync = realRename;
    }
    expect(seenTempNames).toHaveLength(1);
    expect(seenTempNames[0]).not.toBe(file);
    expect(path.dirname(seenTempNames[0])).toBe(dir);
  });
});
