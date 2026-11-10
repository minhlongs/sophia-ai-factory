#!/usr/bin/env node
// Verify Open-Core catalog references, Edge SHA-256 Snapshot, Evidence Vault & License Boundaries (<= 170 LOC)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');
const errors = [];

// 1. Verify modulePaths in open-core-manifest.ts
const manifestFile = path.join(appRoot, 'src/seed/config/open-core-manifest.ts');
if (!fs.existsSync(manifestFile)) {
  errors.push(`Manifest not found at ${manifestFile}`);
} else {
  const manifestContent = fs.readFileSync(manifestFile, 'utf8');
  for (const match of manifestContent.matchAll(/modulePaths:\s*\[([^\]]+)\]/g)) {
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
const communityDirs = ['src/tree/byok', 'src/tree/credentials', 'src/tree/ask', 'src/tree/telegram', 'src/seed/ai']
  .map((rel) => path.join(appRoot, rel));
const bannedImports = ['@/tree/finance/merkle', '@/tree/handover', '@/forest/admin/white-label'];
for (const dir of communityDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.ts'))) {
    const full = path.join(dir, String(file));
    if (fs.statSync(full).isDirectory()) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const banned of bannedImports) {
      if (content.includes(banned)) errors.push(`COMMUNITY file ${full} imports commercial ENTERPRISE_MASTER module: ${banned}`);
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
  if (!providers.some((p) => p.includes('NOWPayments')) || !providers.some((p) => p.includes('PayOS'))) {
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

// 4. Verify docs/SELF_HOSTING.md referenced scripts & GitHub Community Standards files
const pkgJsonPath = path.join(appRoot, 'package.json');
const selfHostingPath = path.join(repoRoot, 'docs/SELF_HOSTING.md');
if (fs.existsSync(pkgJsonPath) && fs.existsSync(selfHostingPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const selfHostingContent = fs.readFileSync(selfHostingPath, 'utf8');
  for (const script of ['type-check', 'test', 'dev']) {
    if ((selfHostingContent.includes(`npm run ${script}`) || selfHostingContent.includes(`npm ${script}`)) && !pkg.scripts?.[script]) {
      errors.push(`docs/SELF_HOSTING.md references missing npm script '${script}'`);
    }
  }
}

const catalogSource = fs.readFileSync(path.join(appRoot, 'src/seed/config/open-core-25-steps-catalog.ts'), 'utf8');
const requiredCommunityFilesMatch = catalogSource.match(/REQUIRED_GITHUB_COMMUNITY_FILES[^=]*=\s*\[([\s\S]*?)\]/);
const requiredCommunityFiles = requiredCommunityFilesMatch
  ? [...requiredCommunityFilesMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  : [];
if (requiredCommunityFiles.length === 0) errors.push('Could not parse REQUIRED_GITHUB_COMMUNITY_FILES from the open-core catalog');
for (const govFile of requiredCommunityFiles) {
  if (!fs.existsSync(path.join(repoRoot, govFile))) errors.push(`Missing GitHub Community Standards file at repo root: ${govFile}`);
}

// 5. Verify 25-Step Open-Core Catalog, Auditor & SHA-256 Edge Snapshot Parity
const p1Path = path.join(appRoot, 'src/seed/config/open-core-25-steps-data-p1.ts');
const p2Path = path.join(appRoot, 'src/seed/config/open-core-25-steps-data-p2.ts');
const auditorPath = path.join(appRoot, 'src/tree/open-core/open-core-25-steps-auditor.ts');
const snapshotPath = path.join(appRoot, 'src/seed/config/open-core-verified-artifacts-snapshot.ts');
let catalogEntries = 0;
let catalogCompletenessPercentage = 0;
let catalogComplete = false;
if (!fs.existsSync(p1Path) || !fs.existsSync(p2Path) || !fs.existsSync(auditorPath) || !fs.existsSync(snapshotPath)) {
  errors.push('Missing 25-step Open-Core catalog, auditor, or verified snapshot files');
} else {
  const combined = fs.readFileSync(p1Path, 'utf8') + '\n' + fs.readFileSync(p2Path, 'utf8');
  const steps = [...combined.matchAll(/\bstep:\s*(\d+)\b/g)].map((match) => Number(match[1]));
  const uniqueSteps = new Set(steps);
  catalogEntries = uniqueSteps.size;
  catalogCompletenessPercentage = Math.round((Array.from(uniqueSteps).filter((s) => s >= 1 && s <= 25).length / 25) * 100);
  const sequenceValid = steps.length === 25 && uniqueSteps.size === 25 &&
    Array.from({ length: 25 }, (_, i) => i + 1).every((step) => uniqueSteps.has(step));
  if (!sequenceValid) errors.push('25-Step Open-Core catalog must contain each step 1..25 exactly once');

  const artifacts = [...combined.matchAll(/verificationArtifact:\s*'([^']+)'/g)].map((match) => match[1]);
  let missingArtifactCount = 0;
  for (const artifact of artifacts) {
    if (!fs.existsSync(path.join(repoRoot, artifact))) {
      missingArtifactCount++;
      errors.push(`Catalog reference does not exist: ${artifact}`);
    }
  }

  const snapshotSrc = fs.readFileSync(snapshotPath, 'utf8');
  const snapListMatch = snapshotSrc.match(/VERIFIED_CATALOG_ARTIFACT_PATHS[^=]*=\s*\[([\s\S]*?)\]/);
  const snapshotPaths = snapListMatch ? [...snapListMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  const snapShaMatch = snapshotSrc.match(/VERIFIED_CATALOG_SHA256\s*=\s*'([0-9a-f]{64})'/);
  const snapshotSha = snapShaMatch ? snapShaMatch[1] : '';
  const expectedUnion = new Set([...artifacts, ...requiredCommunityFiles]);
  const snapshotSet = new Set(snapshotPaths);
  for (const p of snapshotPaths) {
    if (!fs.existsSync(path.join(repoRoot, p))) errors.push(`Snapshot artifact does not exist on disk: ${p}`);
    if (!expectedUnion.has(p)) errors.push(`Verified Edge snapshot contains unreferenced artifact: ${p}`);
  }
  for (const p of expectedUnion) {
    if (!snapshotSet.has(p)) errors.push(`Verified Edge snapshot missing catalog/governance artifact: ${p}`);
  }
  const expectedSha = crypto.createHash('sha256').update(JSON.stringify({
    steps: steps.map((step, idx) => ({ step, artifact: artifacts[idx] })),
    governanceFiles: requiredCommunityFiles,
  })).digest('hex');
  if (snapshotSha !== expectedSha) errors.push(`Verified Edge snapshot SHA-256 drift: expected ${expectedSha}, found ${snapshotSha}`);

  for (const ev of ['plans/evidence/01-zero-to-psf-vc-and-benchmarks.md', 'plans/evidence/02-pilot-reseller-okr-governance.md']) {
    if (!fs.existsSync(path.join(repoRoot, ev))) errors.push(`Missing evidence vault file: ${ev}`);
  }
  for (const bp of ['plans/company-blueprint/plan.md', 'plans/company-blueprint/tasks.md']) {
    const rootBp = path.join(repoRoot, bp);
    const appBp = path.join(appRoot, bp);
    if (fs.existsSync(rootBp) && fs.existsSync(appBp) && fs.readFileSync(rootBp, 'utf8') !== fs.readFileSync(appBp, 'utf8')) {
      errors.push(`Blueprint drift between repo root and app copy: ${bp}`);
    }
  }
  catalogComplete = sequenceValid && artifacts.length === 25 && missingArtifactCount === 0 &&
    snapshotSha === expectedSha && errors.length === 0;
}

const report = {
  timestamp: new Date().toISOString(), passed: errors.length === 0, catalogEntries,
  catalogCompletenessPercentage, catalogComplete, errorCount: errors.length, errors,
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (errors.length > 0) {
  process.stderr.write(`Open-core catalog verification failed with ${errors.length} errors.\n`);
  process.exit(1);
}
process.stderr.write('Open-core catalog references and license boundaries verified successfully.\n');
process.exit(0);
