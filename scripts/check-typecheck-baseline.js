#!/usr/bin/env node
/**
 * Typecheck regression gate.
 *
 * The repository carries a large pre-existing TypeScript error backlog. Making
 * `tsc --noEmit` a pass/fail gate would mean either fixing all of it in one go —
 * a large change across live features, with real regression risk — or ignoring
 * the signal entirely. Neither is useful.
 *
 * So this compares the current error count against a committed baseline and fails
 * only when the count goes UP. New code therefore has to be clean, while the
 * backlog can be burned down incrementally. When the count drops, this prints the
 * command to ratchet the baseline down, so the gate tightens over time and cannot
 * drift back up.
 *
 * Usage:
 *   node scripts/check-typecheck-baseline.js          # verify
 *   node scripts/check-typecheck-baseline.js --update # record the current count
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, 'typecheck-baseline.json');

function countErrors() {
  let output = '';
  try {
    output = execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..'),
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // tsc exits non-zero when there are errors, which is the normal case here.
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }

  const lines = output.split('\n').filter((l) => / error TS\d+/.test(l));
  const byFile = {};
  for (const line of lines) {
    const m = /^(.+?)\(\d+,\d+\): error TS/.exec(line);
    const file = m ? m[1] : '<unknown>';
    byFile[file] = (byFile[file] || 0) + 1;
  }
  return { total: lines.length, byFile };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

const { total, byFile } = countErrors();
const update = process.argv.includes('--update');

if (update) {
  const payload = {
    total,
    recordedAt: new Date().toISOString().slice(0, 10),
    note:
      'Pre-existing TypeScript error backlog. This number must never increase. ' +
      'Lower it as errors are fixed by re-running with --update.',
    topFiles: Object.fromEntries(
      Object.entries(byFile)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
    ),
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Baseline recorded: ${total} errors`);
  process.exit(0);
}

const baseline = readBaseline();
if (!baseline) {
  console.error(
    'No baseline found. Create one with:\n  node scripts/check-typecheck-baseline.js --update'
  );
  process.exit(1);
}

if (total > baseline.total) {
  console.error(
    `\nTypecheck regression: ${total} errors, baseline is ${baseline.total} (+${
      total - baseline.total
    }).\n\n` +
      'New code must not add type errors. Run `npm run typecheck` to see them.\n' +
      'If the increase is genuinely unavoidable, raise the baseline deliberately\n' +
      'and explain why in the commit message.\n'
  );
  process.exit(1);
}

if (total < baseline.total) {
  console.log(
    `Typecheck improved: ${total} errors, baseline was ${baseline.total} (-${
      baseline.total - total
    }).\n` +
      'Ratchet the baseline down so it cannot drift back up:\n' +
      '  node scripts/check-typecheck-baseline.js --update\n'
  );
  process.exit(0);
}

console.log(`Typecheck holding at the ${total}-error baseline.`);
process.exit(0);
