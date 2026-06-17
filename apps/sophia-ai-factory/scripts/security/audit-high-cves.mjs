#!/usr/bin/env node
/**
 * Run npm audit with HIGH severity threshold and fail if vulnerabilities found.
 * Used in pre-push hook and as standalone npm run audit:fail.
 *
 * Phase 06: Supply-Chain Hardening
 */

import { execSync } from 'node:child_process';

function main() {
  try {
    console.log('[audit-high-cves] Running npm audit --audit-level=high...');
    // Run audit with high severity threshold
    // audit exit code: 0 if no vulns, 1 if vulns found, other for errors
    execSync('npm audit --audit-level=high', { stdio: 'inherit' });

    console.log('[audit-high-cves] ✅ No HIGH vulnerabilities');
    return 0;
  } catch (error) {
    // npm audit exits 1 when vulnerabilities are found
    if (error.status === 1) {
      console.error('[audit-high-cves] ❌ HIGH vulnerabilities found');
      console.error('[audit-high-cves] Run `npm audit` for details, or `npm audit fix` to patch');
      return 1;
    } else {
      console.error('[audit-high-cves] ❌ Audit command error:', error.message);
      return 1;
    }
  }
}

process.exit(main());
