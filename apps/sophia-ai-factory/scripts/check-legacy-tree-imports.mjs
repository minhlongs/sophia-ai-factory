#!/usr/bin/env node
/**
 * Direction guard: the four architecture layers must not depend on the legacy
 * `src/components/**` tree.
 *
 * `src/components/stitch/**` renders the authenticated product, but it sits outside the
 * layer model. An import from `seed`/`tree`/`forest`/`land` into that tree inverts the
 * dependency: business logic starts needing a presentation tree that the layer rules do
 * not govern. The existing couplings are pinned; new ones fail.
 *
 * Usage:
 *   node scripts/check-legacy-tree-imports.mjs            # verify
 *   node scripts/check-legacy-tree-imports.mjs --json     # machine-readable
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const LAYERS = ['seed', 'tree', 'forest', 'land'];
const SPECIFIER = /(?:from\s+|import\s+|import\(\s*|require\(\s*)['"](@\/components\/[^'"]+)['"]/;

/**
 * Known couplings, keyed by `file -> specifier`. These predate the guard. Removing one is
 * always allowed; adding one is not.
 */
const ALLOWED = new Set([
  'src/tree/components/setup-wizard/steps/provider-key-fields.tsx -> @/components/onboarding/byok-help-tip',
  'src/tree/components/setup-wizard/steps/api-keys-step.tsx -> @/components/onboarding/byok-help-tip',
  'src/forest/components/byok/form/key-input-form.tsx -> @/components/onboarding/byok-help-tip',
  'src/land/campaigns/campaign-loader.ts -> @/components/stitch/screens/campaigns/campaigns-page-types',
  'src/land/webhooks/webhook-actions.ts -> @/components/stitch/screens/webhook/webhook-cards',
  'src/land/billing/product-catalog-loader.ts -> @/components/stitch/screens/products/products-page',
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...(await walk(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const found = [];
for (const layer of LAYERS) {
  const dir = path.join(process.cwd(), 'src', layer);
  let files;
  try {
    files = await walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    if (/\.(test|spec)\.(ts|tsx)$/.test(file)) continue;
    const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      // Skip documentation comments; prose examples are not dependencies.
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
      const match = line.match(SPECIFIER);
      if (match) found.push({ key: `${rel} -> ${match[1]}`, line: index + 1 });
    });
  }
}

const violations = found.filter((entry) => !ALLOWED.has(entry.key));
const stale = [...ALLOWED].filter((key) => !found.some((entry) => entry.key === key));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: found.length, violations, stale }, null, 2));
} else {
  console.log(`legacy-tree imports from layers: ${found.length} (allowed ${found.length - violations.length})`);
  for (const entry of violations) {
    console.error(`  NEW  ${entry.key} (line ${entry.line})`);
  }
  for (const key of stale) {
    console.log(`  stale allowlist entry, remove it: ${key}`);
  }
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} new dependenc(ies) from a layer into the legacy components tree.`);
  console.error('  Move the shared piece into seed/ or pass it in as a prop instead.');
  process.exit(1);
}

console.log('✔ no new layer -> legacy-tree dependencies');
