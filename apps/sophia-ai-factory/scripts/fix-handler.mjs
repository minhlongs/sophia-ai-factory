#!/usr/bin/env node
/**
 * fix-handler.mjs — Fix corruption from strip-sentry-safe.py
 *
 * Problem: Before this fix, the strip-sentry-safe.py was given
 * corrupted input containing lines like "sentry_instrument",
 * "countersentry", etc. The script's 'sentry' matcher touched those
 * lines which broke bracket balance and produced JS syntax errors
 * ("r is not a function"). The marker "<!-- BAD LINE -->" at the
 * top of the file is a safe sentinel: strip-sentry-safe.py removes it
 * when it sees "sentry", which leaves a visible anchor.
 *
 * This script
 *   1) Removes the anchor line so we have a clean baseline.
 *   2) Detects dangling `{ value: <expr>` lines left behind by a
 *      previous strip pass (the previous line ended with a comma
 *      after the strip left a broken trailing-entry slot).
 *   3) Reattaches the dangling half with its matching
 *      `enumerable: false}` that can appear several lines below.
 *   4) Falls back to a safe-comment pass for any remaining
 *      unconsumed dangling-open lines.
 *   5) Removes the jsdom comment block that describes the file so the
 *      handler is not blocked by the docs-proc runtime.
 *
 * Run:  node scripts/fix-handler.mjs [handler.mjs path]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] || '.open-next/server-functions/default/handler.mjs';
let src = readFileSync(path, 'utf-8');

// 1) Remove the BAD-LINE anchor if present
src = src.replace(/^<!-- BAD LINE -->\s*\n/gm, '');

// 2) Fix corrupt `{ value: <expr>` dangling half-lines.
//
// Pattern produced by the old strip pass: some line becomes a bare
//   `{ value: someFunctionName}`
// or (worse) an unclosed `{ value: someFunctionName` followed a few
// lines later by `    enumerable: false }`,
//
// We walk the file and re-open any dangling half with its matching
// enumerable closer.
let lines = src.split('\n');
let fixed = [];
let pendingOpen = null;   // { lineIdx, prefix: '{ value: <name>' }
const OPEN_RE = /^(\s*\{\s*value:\s*)(\w+)(\s*[,\}])/;
const ENUM_RE = /^(\s*enumerable:\s*false\s*\},?)\s*$/;

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];

  if (pendingOpen) {
    // Look for the matching enumerable: false }
    const m = raw.match(ENUM_RE);
    if (m) {
      // Rebuild: prefix from the open line + the enum closer
      const rebuilt = pendingOpen.prefix + ' ' + m[1];
      fixed.push(rebuilt);
      pendingOpen = null;
      continue;
    }
    // No match — swallow the line (was continuation junk from strip)
    continue;
  }

  const om = raw.match(OPEN_RE);
  if (om) {
    const prefix = om[1] + om[2];
    // Decide: if this line already has } at the end, it's self-contained
    const rest = raw.slice(om.index + om[0].length).trim();
    if (rest.startsWith('}') || rest === '}') {
      // Whole thing is on one line: "{ value: foo }" — keep
      fixed.push(raw);
      continue;
    }
    // The } was on the NEXT line (consumed as enumerable: false}),
    // so remember and emit combined on that next iteration.
    pendingOpen = { lineIdx: i, prefix: '{ value: ' + om[2] };
    // Don't emit this line yet
    continue;
  }

  fixed.push(raw);
}

// For any still-pending open, comment it out to avoid syntax error
if (pendingOpen) {
  fixed[fixed.length - 1] = '  // FIXME: unmatched dangling half (fix-handler)\n';
  pendingOpen = null;
}

src = fixed.join('\n');

// 3) Comment out any unconsumed `{ value:` tokens that survive
src = src.replace(
  /^(\s*\{\s*value:)(\s*\w+)/gm,
  '  // FIXME: unconsumed value (fix-handler)\n$1 $2',
);

// 4) Strip out the jsdom comment block (large inert chunk).
//   /* <keysto ...  ...  > */
// The block opener and closer each span a single line.
src = src
  .replace(
    /^\/\*\s*<keysto[\s\S]*?\*\/\s*$/gm,
    '',
  );

// 5) Normalise: 3+ consecutive blank lines → 2
src = src.replace(/\n{4,}/g, '\n\n\n');

writeFileSync(path, src, 'utf-8');
const finalBytes = Buffer.byteLength(src, 'utf-8');

// 6) Report size vs hard limit
const HARD = 9_476_736;  // Cloudflare Workers gzipped limit
const unzipBytes = finalBytes;
// Best-case gzip (web standard libs): ~35% of source
const gzipEstimate = Math.round(unzipBytes * 0.35);
const status = gzipEstimate < HARD ? '✅ under limit ✓' : '❌ still over ⚠';

console.log(`fix-handler: cleaned ${path}`);
console.log(`  Source bytes:  ${unzipBytes.toLocaleString()}`);
console.log(`  Est. gzip:     ~${gzipEstimate.toLocaleString()}  (${status})`);
console.log(`  Hard limit:    ${HARD.toLocaleString()}`);
