#!/usr/bin/env node
/**
 * Workaround: Next.js 16 standalone output omits instrumentation.js from
 * .next/standalone/<app>/.next/server/. Copy it manually so OpenNext's
 * copyTracedFiles step can find it. Idempotent.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const src = path.join(root, '.next', 'server', 'instrumentation.js');
const standaloneRoot = path.join(root, '.next', 'standalone');

function findStandaloneServerDir() {
  const direct = path.join(standaloneRoot, '.next', 'server');
  if (fs.existsSync(direct)) return direct;
  const monorepoBase = path.join(standaloneRoot, 'apps', 'sophia-ai-factory', '.next', 'server');
  if (fs.existsSync(monorepoBase)) return monorepoBase;
  return null;
}

if (!fs.existsSync(src)) {
  console.warn('warn: ' + src + ' missing — Next build did not produce instrumentation.js');
  process.exit(0);
}

const targetDir = findStandaloneServerDir();
if (!targetDir) {
  console.warn('warn: standalone server dir not found — skipping copy');
  process.exit(0);
}

const dest = path.join(targetDir, 'instrumentation.js');
fs.copyFileSync(src, dest);
console.log('ok: copied instrumentation.js → ' + path.relative(root, dest));
