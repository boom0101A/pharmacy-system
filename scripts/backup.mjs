#!/usr/bin/env node
/**
 * One command, run from the repo root: `npm run backup`.
 *
 * Stages every change, commits it, and pushes to the private GitHub remote —
 * this exists because the project already lost apps/desktop and
 * apps/server/src once to a corrupted local disk. A commit that never leaves
 * this machine is not a backup; the push is the entire point.
 */
import { execFileSync } from 'node:child_process';

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts });
}

function run(label, args) {
  try {
    return git(args);
  } catch (err) {
    console.error(`✗ ${label} فشل:\n${err.stderr || err.message}`);
    process.exit(1);
  }
}

const stamp = new Date().toLocaleString('sv-SE'); // YYYY-MM-DD HH:mm:ss, sorts and reads cleanly

run('git add', ['add', '-A']);

const hasUncommitted = (() => {
  try {
    git(['diff', '--cached', '--quiet']);
    return false; // exit 0 = no staged differences
  } catch {
    return true; // non-zero = there is something to commit
  }
})();

if (hasUncommitted) {
  run('git commit', ['commit', '-m', `نسخة احتياطية: ${stamp}`]);
  console.log('✓ حُفظ التغيير محلياً.');
}

run('git fetch', ['fetch', 'origin']);

// Not just "did this run just commit something": a commit made earlier by a
// plain `git commit` (outside this script) is just as stuck on this one
// machine until something pushes it — which is the exact failure mode this
// script exists to prevent.
const ahead = git(['rev-list', '--count', '@{u}..HEAD']).trim() !== '0';

if (!hasUncommitted && !ahead) {
  console.log('لا توجد تغييرات جديدة — كل شيء محفوظ فعلاً على GitHub.');
  process.exit(0);
}

console.log('جارٍ الرفع إلى GitHub…');
run('git push', ['push', 'origin', 'HEAD']);

const hash = git(['rev-parse', '--short', 'HEAD']).trim();
const remote = git(['remote', 'get-url', 'origin']).trim().replace(/\.git$/, '');
console.log(`✓ تم الرفع بنجاح (${hash}).\n${remote}`);
