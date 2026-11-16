#!/usr/bin/env node
/**
 * Ratchet guardrail for hardcoded colors.
 *
 * The token layer only holds if color literals cannot creep back in. This check compares
 * the current count of `#rrggbb` literals per file against a committed baseline and fails
 * when any file grows or a new file introduces literals. It never blocks a reduction —
 * run with --update to ratchet the baseline down after a migration.
 *
 * Usage:
 *   node scripts/check-hardcoded-color.mjs            # verify
 *   node scripts/check-hardcoded-color.mjs --update   # rewrite baseline from current tree
 *   node scripts/check-hardcoded-color.mjs --json     # machine-readable output
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');
const BASELINE = path.join(process.cwd(), 'scripts', 'ui-color-baseline.json');
const HEX = /#[0-9a-fA-F]{6}\b/g;

const update = process.argv.includes('--update');
const asJson = process.argv.includes('--json');

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      found.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

const files = await walk(SRC);
const counts = new Map();

for (const file of files) {
  const hits = (await readFile(file, 'utf8')).match(HEX);
  if (hits) counts.set(path.relative(process.cwd(), file), hits.length);
}

const sorted = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

if (update) {
  const next = { total, files: sorted };
  await writeFile(BASELINE, JSON.stringify(next, null, 2) + '\n');
  console.log(`baseline written: ${Object.keys(sorted).length} files, ${total} literals`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(await readFile(BASELINE, 'utf8'));
} catch {
  console.error(`missing baseline at ${path.relative(process.cwd(), BASELINE)}`);
  console.error('run: node scripts/check-hardcoded-color.mjs --update');
  process.exit(1);
}

const regressions = [];
for (const [file, n] of Object.entries(sorted)) {
  const allowed = baseline.files[file] ?? 0;
  if (n > allowed) {
    regressions.push({ file, allowed, actual: n, delta: n - allowed });
  }
}

const reductions = Object.entries(baseline.files)
  .filter(([file, allowed]) => (sorted[file] ?? 0) < allowed)
  .map(([file, allowed]) => ({ file, allowed, actual: sorted[file] ?? 0 }));

if (asJson) {
  console.log(JSON.stringify({ total, baselineTotal: baseline.total, regressions, reductions }, null, 2));
} else {
  console.log(`hardcoded color literals: ${total} (baseline ${baseline.total})`);
  for (const r of reductions.slice(0, 10)) {
    console.log(`  down  ${r.file}: ${r.allowed} -> ${r.actual}`);
  }
  if (reductions.length) {
    console.log(`  ${reductions.length} file(s) improved — run --update to ratchet the baseline down`);
  }
  for (const r of regressions) {
    console.error(`  NEW   ${r.file}: ${r.allowed} -> ${r.actual} (+${r.delta})`);
  }
}

if (regressions.length > 0) {
  console.error(`\n✖ ${regressions.length} file(s) introduced new hardcoded colors.`);
  console.error('  Use a semantic token (bg-card, text-muted-foreground, border-border) instead of a literal.');
  process.exit(1);
}

console.log('✔ no new hardcoded colors');
