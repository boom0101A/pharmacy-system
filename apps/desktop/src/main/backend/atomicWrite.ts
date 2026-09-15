import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Writes a file so a crash or a power loss mid-write can never leave a
 * half-written, corrupt target — a plain `writeFileSync` truncates the file
 * before writing the new bytes, so an interruption at the wrong instant
 * leaves 0 bytes or a torn JSON document. Writing to a temp file in the same
 * directory first and renaming it into place instead means the target is
 * either fully the old content or fully the new content, never in between —
 * a rename is a single filesystem operation, not a byte-by-byte copy.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, filePath);
}
