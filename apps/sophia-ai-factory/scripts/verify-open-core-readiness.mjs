#!/usr/bin/env node
/**
 * Verify Open-Core Readiness & License Boundaries (Lane 2)
 *
 * Verifies:
 * 1. All modulePaths declared in OPEN_CORE_FEATURES exist on disk.
 * 2. COMMUNITY modules do not directly import commercial ENTERPRISE_MASTER modules.
 * 3. Truthful baseline in .mekong/company.json (mrr_usd: 0, paying_customers: 0).
 * 4. Payment providers only include NOWPayments and PayOS (Polar/PayPal banned).
 * 5. npm scripts in docs/SELF_HOSTING.md exist in apps/sophia-ai-factory/package.json.
 *
 * File size budget: <= 170 LOC. Uses process.stdout.write. Exits 0 on success.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');

const errors = [];

// 1. Verify modulePaths in open-core-manifest.ts
const manifestFile = path.join(appRoot, 'src/seed/config/open-core-manifest.ts');
if (!fs.existsSync(manifestFile)) {
  errors.push(`Manifest not found at ${manifestFile}`);
} else {
  const manifestContent = fs.readFileSync(manifestFile, 'utf8');
  const pathMatches = [...manifestContent.matchAll(/modulePaths:\s*\[([^\]]+)\]/g)];
  for (const match of pathMatches) {
    const rawPaths = match[1].split(',').map((p) => p.trim().replace(/['"]/g, '')).filter(Boolean);
    for (const p of rawPaths) {
      const full = path.join(appRoot, p);
      if (!fs.existsSync(full) && !fs.existsSync(`${full}.ts`) && !fs.existsSync(`${full}.tsx`)) {
        errors.push(`Declared modulePath does not exist on disk: ${p}`);
      }
    }
  }
}

// 2. Verify COMMUNITY modules do not import ENTERPRISE_MASTER modules
const communityDirs = [
  path.join(appRoot, 'src/tree/byok'),
  path.join(appRoot, 'src/tree/credentials'),
  path.join(appRoot, 'src/tree/ask'),
  path.join(appRoot, 'src/tree/telegram'),
  path.join(appRoot, 'src/seed/ai'),
];

const bannedImports = [
  '@/tree/finance/merkle',
  '@/tree/handover',
  '@/forest/admin/white-label',
];

for (const dir of communityDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.ts'));
  for (const file of files) {
    const full = path.join(dir, String(file));
    if (fs.statSync(full).isDirectory()) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const banned of bannedImports) {
      if (content.includes(banned)) {
        errors.push(`COMMUNITY file ${full} imports commercial ENTERPRISE_MASTER module: ${banned}`);
      }
    }
  }
}

// 3. Verify .mekong/company.json baseline and payment providers
const companyJsonPath = path.join(repoRoot, '.mekong/company.json');
if (!fs.existsSync(companyJsonPath)) {
  errors.push(`.mekong/company.json not found at ${companyJsonPath}`);
} else {
  const company = JSON.parse(fs.readFileSync(companyJsonPath, 'utf8'));
  if (company.metrics?.current?.mrr_usd !== 0) {
    errors.push(`Untruthful MRR baseline in company.json: expected 0, got ${company.metrics?.current?.mrr_usd}`);
  }
  if (company.metrics?.current?.paying_customers !== 0) {
    errors.push(`Untruthful paying_customers baseline: expected 0, got ${company.metrics?.current?.paying_customers}`);
  }
  const providers = (company.business_model?.payment_providers ?? []).map(String);
  const bannedProviders = (company.business_model?.banned_payment_providers ?? []).map(String);
  const hasNowpayments = providers.some((p) => p.includes('NOWPayments'));
  const hasPayOs = providers.some((p) => p.includes('PayOS'));
  if (!hasNowpayments || !hasPayOs) {
    errors.push(`Active payment providers must be NOWPayments and PayOS; found: ${providers.join(', ')}`);
  }
  for (const banned of ['Polar', 'PayPal']) {
    if (providers.some((p) => p.toLowerCase().includes(banned.toLowerCase()))) {
      errors.push(`Banned payment provider found in active providers: ${banned}`);
    }
    if (!bannedProviders.some((p) => p.toLowerCase().includes(banned.toLowerCase()))) {
      errors.push(`Banned payment provider missing from banned_payment_providers list: ${banned}`);
    }
  }
}

// 4. Verify docs/SELF_HOSTING.md referenced scripts exist in package.json
const pkgJsonPath = path.join(appRoot, 'package.json');
const selfHostingPath = path.join(repoRoot, 'docs/SELF_HOSTING.md');
if (fs.existsSync(pkgJsonPath) && fs.existsSync(selfHostingPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const selfHostingContent = fs.readFileSync(selfHostingPath, 'utf8');
  const referencedScripts = ['type-check', 'test', 'dev'];
  for (const script of referencedScripts) {
    if (selfHostingContent.includes(`npm run ${script}`) || selfHostingContent.includes(`npm ${script}`)) {
      if (!pkg.scripts?.[script]) {
        errors.push(`docs/SELF_HOSTING.md references npm script '${script}' which is missing in package.json`);
      }
    }
  }
}

const report = {
  timestamp: new Date().toISOString(),
  passed: errors.length === 0,
  errorCount: errors.length,
  errors,
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (errors.length > 0) {
  process.stderr.write(`Open-core readiness verification failed with ${errors.length} errors.\n`);
  process.exit(1);
} else {
  process.stdout.write('Open-core readiness and license boundaries verified successfully.\n');
  process.exit(0);
}
