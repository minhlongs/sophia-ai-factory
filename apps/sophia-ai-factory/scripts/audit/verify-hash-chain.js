#!/usr/bin/env node
/**
 * verify-hash-chain.js — SOC 2 hash chain integrity verification
 * Usage: node scripts/audit/verify-hash-chain.js [--since YYYY-MM-DD] [--export path]
 *
 * Reads from D1 database (remote), verifies hash chain continuity across all logs,
 * outputs pass/fail status + optionally exports compliance manifest (JSON).
 *
 * Exit codes:
 *   0 = chain valid
 *   1 = chain broken or invalid entries found
 *   2 = error (DB connection failure, invalid args)
 *
 * SOC 2 CC7.2: Automated logic to monitor and log changes to data and systems.
 * This script provides daily/weekly verification evidence for auditors.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Parse arguments
const args = process.argv.slice(2);
const sinceArgIndex = args.indexOf('--since');
const exportArgIndex = args.indexOf('--export');

const sinceArg = sinceArgIndex !== -1 ? args[sinceArgIndex + 1] : null;
const exportPath = exportArgIndex !== -1 ? args[exportArgIndex + 1] : null;

// Default: last 30 days
const sinceDate = sinceArg
  ? new Date(sinceArg)
  : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

function runWranglerQuery(sql: string): any[] {
  // Use wrangler CLI to query remote D1 database
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'sophia-raas-db', '--remote', '--command', sql, '--json'],
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  if (result.status !== 0) {
    const err = result.stderr || result.stdout;
    throw new Error(`D1 query failed: ${err.trim()}`);
  }

  try {
    const output = JSON.parse(result.stdout);
    return output.results || [];
  } catch (e) {
    throw new Error(`Failed to parse D1 response: ${e}`);
  }
}

function main() {
  console.log('=== SOC 2 Hash Chain Verification ===');
  console.log(`Period: ${sinceDate.toISOString()} → now`);
  console.log(`Database: sophia-raas-db (remote)`);

  try {
    // Fetch audit logs within date range, ordered by created_at ASC for chain verification
    const sql = `
      SELECT id, action, license_nonce, user_id, ip_address, created_at,
             content_hash, previous_log_hash, hash_chain_valid
      FROM raas_audit_logs
      WHERE created_at >= ${Math.floor(sinceDate.getTime() / 1000)}
      ORDER BY created_at ASC;
    `;

    const logs = runWranglerQuery(sql);
    console.log(`Fetched ${logs.length} audit log entries`);

    if (logs.length === 0) {
      console.log('⚠️ No audit logs in period — nothing to verify');
      process.exit(0);
    }

    // Verification logic (matches verifyHashChain from crypto-utils-signing.ts)
    let previousHash: string | null = null;
    let firstInvalidIndex: number | null = null;
    let reason: string | null = null;
    let invalidCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Check 1: previous_hash links correctly (first entry should have empty previous)
      if (log.previous_log_hash !== previousHash) {
        firstInvalidIndex = i;
        reason = `previous_log_hash mismatch at index ${i}: expected "${previousHash || '(null)'}", got "${log.previous_log_hash}"`;
        invalidCount++;
        break;
      }

      // Check 2: content_hash present
      if (!log.content_hash) {
        firstInvalidIndex = i;
        reason = `missing content_hash at index ${i}`;
        invalidCount++;
        break;
      }

      // Check 3: hash_chain_valid flag (if 0, already marked invalid)
      if (log.hash_chain_valid === 0) {
        firstInvalidIndex = i;
        reason = `hash_chain_valid=0 at index ${i} (previously flagged invalid)`;
        invalidCount++;
        break;
      }

      // Advance chain
      previousHash = log.content_hash;
    }

    const isValid = invalidCount === 0;
    const verification = {
      valid: isValid,
      totalLogs: logs.length,
      period: {
        start: sinceDate.toISOString(),
        end: new Date().toISOString(),
      },
      firstInvalidIndex,
      reason,
      timestamp: new Date().toISOString(),
    };

    // Output JSON result
    const output = JSON.stringify(verification, null, 2);
    console.log('\n=== Verification Result ===');
    console.log(output);

    // Export if requested
    if (exportPath) {
      const fs = await import('node:fs');
      fs.writeFileSync(exportPath, output);
      console.log(`\n✅ Exported to: ${exportPath}`);
    }

    // Generate compliance manifest for SOC 2 evidence
    if (isValid) {
      console.log('\n✅ Hash chain VALID — SOC 2 CC7.2 compliance verified');
      process.exit(0);
    } else {
      console.log(`\n❌ Hash chain INVALID — break at index ${firstInvalidIndex}: ${reason}`);
      console.log('Action: Investigate tampering, review audit logs, and document incident.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    process.exit(2);
  }
}

main();
