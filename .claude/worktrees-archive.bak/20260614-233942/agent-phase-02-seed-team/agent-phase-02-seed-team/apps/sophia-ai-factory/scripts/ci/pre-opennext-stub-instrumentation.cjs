#!/usr/bin/env node
/**
 * Workaround for Next.js 16 + OpenNext bug: standalone output omits
 * instrumentation.js even though .nft.json references it. Pre-create the
 * file (copy from .next/server) so OpenNext copyTracedFiles finds it.
 *
 * Run AFTER `next build`, BEFORE `npx @opennextjs/cloudflare build --skipNextBuild`.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const src = path.join(root, '.next', 'server', 'instrumentation.js');

const candidates = [
  path.join(root, '.next', 'standalone', '.next', 'server'),
  path.join(root, '.next', 'standalone', 'apps', 'sophia-ai-factory', '.next', 'server'),
];

if (!fs.existsSync(src)) {
  console.warn('warn: ' + src + ' missing — skipping stub');
  process.exit(0);
}

let copies = 0;
for (const dir of candidates) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const dest = path.join(dir, 'instrumentation.js');
  if (fs.existsSync(dest)) {
    console.log('exists: ' + path.relative(root, dest));
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log('ok: ' + path.relative(root, dest));
  copies += 1;
}

if (copies === 0) {
  console.log('info: no copies needed');
}
