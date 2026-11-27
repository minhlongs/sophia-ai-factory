#!/usr/bin/env node
/**
 * Automated Quality Gate: Google MD3 Expressive + Modern Web Guidance.
 * Verifies canonical tokens, @view-transition, prefers-reduced-motion,
 * and zero hardcoded light/slate backgrounds in src/components/md3/.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssPath = path.join(root, 'src/styles/md3-expressive-modern-web.css');
const md3Dir = path.join(root, 'src/components/md3');

const css = fs.readFileSync(cssPath, 'utf8');
const requiredCss = [
  '@view-transition',
  '--md-sys-color-surface-container-lowest',
  '--md-sys-color-surface-container-highest',
  '--md-sys-state-hover',
  'prefers-reduced-motion',
  'content-visibility: auto',
  'tabular-nums',
];

const errors = [];
for (const token of requiredCss) {
  if (!css.includes(token)) {
    errors.push(`Missing required MD3/Modern-Web CSS feature: ${token}`);
  }
}

for (const file of fs.readdirSync(md3Dir)) {
  if (!file.endsWith('.tsx')) continue;
  const content = fs.readFileSync(path.join(md3Dir, file), 'utf8');
  if (/\bbg-white\b|\bdark:bg-slate-900\b/.test(content)) {
    errors.push(`Hardcoded bg-white/slate-900 found in src/components/md3/${file}`);
  }
}

if (errors.length > 0) {
  console.error('❌ MD3 / Modern Web Guidance Gate FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('✅ MD3 Expressive + Modern Web Guidance Gate PASSED (100/100)');
