#!/usr/bin/env node
/**
 * verify-core-video-factory-evidence.mjs
 *
 * Reads the evidence JSON produced by the verifier and validates:
 * - All gates passed
 * - Required artifacts present (video row, mock video URL)
 * - No real API keys were used (proof mode enforced)
 *
 * Usage: node scripts/verify-core-video-factory-evidence.mjs [evidence-path]
 * Default evidence path: plans/reports/core-video-factory-proof-latest.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function resolveEvidencePath() {
  const cliArg = process.argv[2];
  if (cliArg) return resolve(root, cliArg);
  const latest = resolve(root, 'plans/reports/core-video-factory-proof-latest.json');
  if (existsSync(latest)) return latest;
  // Fall back to timestamped file in plans/reports/
  const reportsDir = resolve(root, 'plans/reports');
  const files = [];
  try {
    const entries = require('node:fs').readdirSync(reportsDir);
    files.push(...entries.filter((f) => f.startsWith('core-video-factory-proof-') && f.endsWith('.json')));
  } catch { /* directory may not exist */ }
  files.sort().reverse();
  if (files.length === 0) {
    console.error('FAIL: no evidence file found in plans/reports/');
    process.exit(1);
  }
  return resolve(root, 'plans/reports', files[0]);
}

function main() {
  const evidencePath = resolveEvidencePath();
  console.log(`Validating evidence: ${evidencePath}`);

  if (!existsSync(evidencePath)) {
    console.error(`FAIL: evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));
  } catch (err) {
    console.error(`FAIL: could not parse evidence JSON: ${err.message}`);
    process.exit(1);
  }

  const checks = [];

  // Check 1: all gates passed
  const gates = evidence.gates ?? [];
  const allPassed = gates.every((g) => g.status === 'passed');
  checks.push({ name: 'all gates passed', passed: allPassed });

  // Check 2: proof mode was active (no real keys)
  const proofMode = evidence.proofMode ?? false;
  checks.push({ name: 'proof mode active', passed: proofMode });

  // Check 3: mock provider was used
  const provider = evidence.provider ?? 'unknown';
  checks.push({ name: 'mock provider used', passed: provider === 'mock' });

  // Check 4: video artifact has deterministic URL
  const videoUrl = evidence.artifacts?.videoUrl ?? '';
  const hasMockUrl = videoUrl.includes('mock.sophia.local');
  checks.push({ name: 'mock video URL present', passed: hasMockUrl });

  // Check 5: video row status is completed
  const videoStatus = evidence.artifacts?.videoStatus ?? '';
  checks.push({ name: 'video status completed', passed: videoStatus === 'completed' });

  // Print results
  let allOk = true;
  for (const check of checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}`);
    if (!check.passed) allOk = false;
  }

  if (!allOk) {
    console.error('\nEVIDENCE VALIDATION FAILED');
    process.exit(1);
  }

  console.log('\nEVIDENCE VALID: core video factory proof is complete and verified.');
}

main();
