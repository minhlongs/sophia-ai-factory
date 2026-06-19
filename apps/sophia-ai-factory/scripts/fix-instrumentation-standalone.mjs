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

import { copyFileSync, existsSync, mkdirSync, cpSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

// OpenNext expects files at .next/server/ (this is the main build output - already populated)
const serverDir = join(appRoot, '.next', 'server');
// Turbopack standalone output is at .next/standalone/.next/server/ (missing instrumentation/middleware)
const standaloneServerDir = join(appRoot, '.next', 'standalone', '.next', 'server');

console.log('[debug] appRoot:', appRoot);
console.log('[debug] serverDir (source):', serverDir);
console.log('[debug] standaloneServerDir (target):', standaloneServerDir);

// Copy missing instrumentation and middleware files from full build to standalone
if (!existsSync(standaloneServerDir)) {
  mkdirSync(standaloneServerDir, { recursive: true });
}

const filesToCopy = [
  'instrumentation.js',
  'instrumentation.js.map',
  'instrumentation.js.nft.json',
  'middleware',
  'middleware-build-manifest.js',
  'middleware-manifest.json',
];

let copyCount = 0;
for (const file of filesToCopy) {
  const src = join(serverDir, file);
  const dest = join(standaloneServerDir, file);

  if (!existsSync(src)) {
    continue; // file may not exist in all builds
  }

  if (existsSync(dest)) {
    // If dest exists and is a directory, skip; if file exists, skip
    if (statSync(dest).isDirectory()) continue;
    // Remove existing file to replace
    unlinkSync(dest);
  }

  if (statSync(src).isDirectory()) {
    cpSync(src, dest, { recursive: true });
  } else {
    copyFileSync(src, dest);
  }
  console.log(`[fix-instrumentation] COPIED ${file} → .next/standalone/.next/server/`);
  copyCount++;
}

console.log(`[fix-instrumentation] Done: ${copyCount} items copied.`);
