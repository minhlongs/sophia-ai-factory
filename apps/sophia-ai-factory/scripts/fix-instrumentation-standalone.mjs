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

import { copyFileSync, existsSync, mkdirSync, cpSync, rmSync, statSync, unlinkSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
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
  'edge',
  'middleware',
  'middleware-build-manifest.js',
  'middleware-manifest.json',
];

// Parse instrumentation.js.nft.json to copy referenced chunks alongside the loader
const nftForInstrumentation = join(serverDir, 'instrumentation.js.nft.json');
const instrumentationChunks = [];
if (existsSync(nftForInstrumentation)) {
  try {
    const nftContent = readFileSync(nftForInstrumentation, 'utf8');
    const nft = JSON.parse(nftContent);
    const files = nft.files ?? [];
    // nft entries are relative to the server dir, e.g. "./chunks/_0.zwy-~._.js"
    instrumentationChunks.push(...files.filter((f) => typeof f === 'string' && f.endsWith('.js')));
  } catch (e) {
    console.warn('[fix-instrumentation] Failed to parse instrumentation.nft.json', e?.message ?? String(e));
  }
}

let copyCount = 0;
for (const file of filesToCopy) {
  const src = join(serverDir, file);
  const dest = join(standaloneServerDir, file);

  if (!existsSync(src)) {
    continue; // file may not exist in all builds
  }

  if (existsSync(dest)) {
    // If dest is a directory, overwrite recursively; if file, replace
    if (statSync(dest).isDirectory()) {
      cpSync(src, dest, { recursive: true });
      console.log(`[fix-instrumentation] OVERWROTE ${file} → .next/standalone/.next/server/`);
      copyCount++;
      continue;
    }
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

// Copy instrumentation chunk dependencies referenced by instrumentation.js.nft.json
const standaloneChunksDir = join(standaloneServerDir, 'chunks');
for (const rel of instrumentationChunks) {
  // Strip leading "./" if present
  const relClean = rel.replace(/^\.\//, '');
  const srcChunk = join(serverDir, relClean);
  const destChunk = join(standaloneChunksDir, basename(relClean));
  if (!existsSync(srcChunk)) {
    console.warn(`[fix-instrumentation] MISSING chunk ${relClean} — skipping`);
    continue;
  }
  if (existsSync(destChunk)) {
    if (statSync(destChunk).isDirectory()) continue;
    unlinkSync(destChunk);
  }
  copyFileSync(srcChunk, destChunk);
  console.log(`[fix-instrumentation] COPIED chunk ${relClean} → .next/standalone/.next/server/chunks/`);
}

// ---------------------------------------------------------------------------
// Strip @opentelemetry/* + @sentry OTel deps from SSR runtime stubs.
// These files are inertia-copied into the deploy artifact by Turbopack
// but are NEVER used in the Workers runtime (instrumentation.ts short-circuits).
// Stripping saves ~1.1 MB and removes Node-only modules that cause issues.
// Targets both:
//   - .next/server/node_modules/@opentelemetry (primary build)
//   - .next/standalone/.next/server/node_modules/@opentelemetry (standalone copy)
//   - nested @sentry/node/node_modules/@opentelemetry (transitive dep)
// ---------------------------------------------------------------------------
import { readdirSync } from 'node:fs';

function stripDir(baseRel) {
  const candidates = [
    join(serverDir, baseRel),
    join(standaloneServerDir, baseRel),
  ];
  let strippedBytes = 0;
  for (const target of candidates) {
    if (!existsSync(target)) continue;
    const calcSize = (dir) => {
      let total = 0;
      try {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          const s = statSync(full);
          total += s.isDirectory() ? calcSize(full) : s.size;
        }
      } catch { /* skip unreadable entries */ }
      return total;
    };
    strippedBytes += calcSize(target);
    rmSync(target, { recursive: true, force: true });
    console.log(`[fix-instrumentation] STRIPPED ${baseRel} from ${target} (-${(strippedBytes / 1024 / 1024).toFixed(2)} MB)`);
  }
  return strippedBytes;
}

function stripChunks(pattern) {
  const bases = [
    join(serverDir, 'chunks'),
    join(standaloneServerDir, 'chunks'),
  ];
  let strippedBytes = 0;
  for (const chunksDir of bases) {
    if (!existsSync(chunksDir)) continue;
    // Scan both the chunks root and an optional ssr/ subdirectory
    const scanDirs = [chunksDir];
    const ssrDir = join(chunksDir, 'ssr');
    if (existsSync(ssrDir) && statSync(ssrDir).isDirectory()) scanDirs.push(ssrDir);
    for (const dir of scanDirs) {
      const relPrefix = dir === chunksDir ? 'chunks/' : 'chunks/ssr/';
      for (const entry of readdirSync(dir)) {
        if (!entry.startsWith(pattern)) continue;
        const full = join(dir, entry);
        const calcSize = (d) => {
          let total = 0;
          try {
            for (const e of readdirSync(d)) {
              const f = join(d, e);
              const s = statSync(f);
              total += s.isDirectory() ? calcSize(f) : s.size;
            }
          } catch { /* skip */ }
          return total;
        };
        const size = calcSize(full);
        strippedBytes += size;
        rmSync(full, { recursive: true, force: true });
        console.log(`[fix-instrumentation] STRIPPED ${relPrefix}${entry} (-${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  }
  return strippedBytes;
}

let totalStripped = 0;
totalStripped += stripDir('node_modules/@opentelemetry');
totalStripped += stripDir('node_modules/@sentry/node/node_modules/@opentelemetry');
// Strip compiled OTel SSR chunks (the biggest source — each ~200-400KB)
// Patterns cover both `chunks/` root and `chunks/ssr/` subdirectory
// Note: Next.js 16 Turbopack uses TWO naming conventions for OTel:
//   - `node_modules_@opentelemetry_*` (webpack-style)
//   - `0_lp_modules_@opentelemetry_*` (Turbopack lazy-parcel style)
totalStripped += stripChunks('node_modules_@opentelemetry');
totalStripped += stripChunks('node_modules__opentelemetry');
totalStripped += stripChunks('node_modules_next_dist_compiled_@opentelemetry');
totalStripped += stripChunks('0_lp_modules_@opentelemetry');

console.log(`[fix-instrumentation] Done: ${copyCount} items copied, OTel stripped: ${(totalStripped / 1024 / 1024).toFixed(2)} MB.`);
