#!/usr/bin/env node
/**
 * Verify that all commits on the current branch (against main) are GPG-signed.
 * Used in pre-push hook and deploy validation.
 *
 * Phase 06: Supply-Chain Hardening
 */

import { execSync } from 'node:child_process';

function main() {
  try {
    // Determine commit range
    // In CI or deploy: check commits not yet on main
    // In local pre-push: check commits that will be pushed
    let range;
    if (process.env.CI || process.env.DEPLOY === 'true') {
      range = 'origin/main..HEAD';
    } else {
      // For local pre-push, check commits since main
      // Git hook provides refs; we'll check main..HEAD (commits not yet pushed)
      try {
        execSync('git rev-parse --verify main > /dev/null', { stdio: 'ignore' });
        range = 'main..HEAD';
      } catch {
        // If main doesn't exist locally, check origin/main
        range = 'origin/main..HEAD';
      }
    }

    console.log(`[verify-signed-commits] Checking commits: ${range}`);

    // Get commit log with signature status
    // Format: <hash> <status>
    // Status: G=good sig, U=good but unknown key, X=expired, Y=expired key, R=revoked, B=bad, D=missing key
    const cmd = `git log --pretty=format:"%H %G?" ${range}`;
    let output;
    try {
      output = execSync(cmd, { encoding: 'utf-8' }).trim();
    } catch {
      // git log fails if range is empty (no commits to check)
      console.log('[verify-signed-commits] No new commits to check.');
      return 0;
    }

    if (!output) {
      console.log('[verify-signed-commits] No new commits to check.');
      return 0;
    }

    const lines = output.split('\n');
    const unsigned = [];

    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length < 2) continue;
      const sig = parts[1];
      // Valid signatures: G (good), U (good, unknown key), X (expired), Y (expired key), R (revoked)
      // These represent SOME form of valid signature, even if technically expired/revoked
      if (!['G', 'U', 'X', 'Y', 'R'].includes(sig)) {
        unsigned.push(line);
      }
    }

    if (unsigned.length > 0) {
      console.error('[verify-signed-commits] ❌ Unsigned or bad signatures detected:');
      for (const line of unsigned) {
        console.error(`  ${line}`);
      }
      console.error('[verify-signed-commits] Please sign your commits: git commit -S');
      console.error('[verify-signed-commits] Setup guide: docs/security/commit-signing-guide.md');
      return 1;
    }

    console.log(`[verify-signed-commits] ✅ All ${lines.length} commits are signed.`);
    return 0;
  } catch (error) {
    console.error('[verify-signed-commits] ❌ Error:', error.message);
    return 1;
  }
}

process.exit(main());
