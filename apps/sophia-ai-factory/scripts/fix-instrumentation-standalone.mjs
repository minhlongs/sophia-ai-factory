/**
 * fix-instrumentation-standalone.mjs
 *
 * Next.js 16+ does not copy instrumentation.js into the standalone output.
 * OpenNext's copyTracedFiles expects it there (alongside instrumentation.js.nft.json).
 * This script copies the missing file(s) before @opennextjs/cloudflare processes the bundle.
 *
 * Run: node scripts/fix-instrumentation-standalone.mjs
 * Called automatically by deploy/deploy:build scripts (between next build and opennext build).
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

const serverDir = join(appRoot, '.next', 'server');
const standaloneServerDir = join(appRoot, '.next', 'standalone', '.next', 'server');

const filesToCopy = [
  'instrumentation.js',
  'instrumentation.js.map',
];

mkdirSync(standaloneServerDir, { recursive: true });

let copied = 0;
let skipped = 0;

for (const file of filesToCopy) {
  const src = join(serverDir, file);
  const dest = join(standaloneServerDir, file);

  if (!existsSync(src)) {
    console.log(`[fix-instrumentation] SKIP ${file} — not in .next/server/ (optional)`);
    skipped++;
    continue;
  }

  if (existsSync(dest)) {
    console.log(`[fix-instrumentation] SKIP ${file} — already in standalone`);
    skipped++;
    continue;
  }

  copyFileSync(src, dest);
  console.log(`[fix-instrumentation] COPIED ${file} → standalone`);
  copied++;
}

console.log(`[fix-instrumentation] Done: ${copied} copied, ${skipped} skipped.`);
