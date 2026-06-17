#!/usr/bin/env node
/**
 * Generate SBOM (Software Bill of Materials) in CycloneDX JSON format.
 * Output: .sbom/sbom-<shortSha>.json
 *
 * Phase 06: Supply-Chain Hardening
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// Get git SHA (short)
const shortSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

// Output directory and filename
const outputDir = join(process.cwd(), '.sbom');
const outputFile = join(outputDir, `sbom-${shortSha}.json`);

async function main() {
  try {
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    // Generate SBOM using cyclonedx-npm CLI
    // Uses package-lock.json to capture exact dependency tree
    const cmd = `npx --no-install cyclonedx-npm --output-format JSON --output-file "${outputFile}"`;
    console.log(`[generate-sbom] Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });

    // Verify output exists
    const sbomContent = await readFile(outputFile, 'utf-8');
    const sbom = JSON.parse(sbomContent);
    console.log(`[generate-sbom] ✅ SBOM written: ${outputFile}`);
    console.log(`[generate-sbom] Components: ${sbom.components?.length || 0}`);
  } catch (error) {
    console.error('[generate-sbom] ❌ Failed:', error.message);
    process.exit(1);
  }
}

main();
