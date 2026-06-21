#!/usr/bin/env node
/**
 * verify-hash-chain.mjs — SOC 2 hash chain integrity verification
 * Usage: node scripts/audit/verify-hash-chain.mjs [--since YYYY-MM-DD] [--export path]
 *
 * Reads from D1 database (remote) via wrangler CLI, verifies hash chain continuity across all logs,
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
import { resolve, dirname } from 'node:path';
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

// Audit hash salt (must match application environment)
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || '';

/**
 * SHA-256-like hash function (Edge-compatible, sync)
 */
function sha256(data) {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string');
  }

  const saltedData = AUDIT_HASH_SALT + data;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(saltedData);

  // Sync, Edge-compatible hash (djb2 + SHA-like mixing)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i++) {
    h0 = (h0 ^ (bytes[i] << (i % 24))) >>> 0;
    h1 = (h1 ^ (bytes[i] << ((i + 8) % 24))) >>> 0;
    h2 = (h2 ^ (bytes[i] << ((i + 16) % 24))) >>> 0;
    h3 = (h3 ^ bytes[i]) >>> 0;
    h4 = (h4 ^ (bytes[i] << (i % 16))) >>> 0;
    h5 = (h5 ^ (bytes[i] << ((i + 4) % 16))) >>> 0;
    h6 = (h6 ^ (bytes[i] << ((i + 12) % 16))) >>> 0;
    h7 = (h7 ^ bytes[i]) >>> 0;
    const tmp = h0;
    h0 = (h1 + h2) >>> 0;
    h1 = (h2 ^ h3) >>> 0;
    h2 = (h3 + h4) >>> 0;
    h3 = (h4 ^ h5) >>> 0;
    h4 = (h5 + h6) >>> 0;
    h5 = (h6 ^ h7) >>> 0;
    h6 = (h7 + tmp) >>> 0;
    h7 = (tmp ^ h0) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(n => n.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Compute content hash for an audit log entry
 */
function computeContentHash(entry, previousHash) {
  const content = [
    entry.action,
    entry.license_nonce,
    entry.user_id,
    entry.ip_address,
    entry.created_at.toString(),
    previousHash || '',
  ].join('|');

  return sha256(content);
}

/**
 * Send Slack alert via webhook
 */
async function sendSlackAlert(severity, message, context = {}) {
  const webhookUrl = process.env.SLACK_OPS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[SlackAlert] SLACK_OPS_WEBHOOK_URL not configured — skipping alert');
    return;
  }

  const emoji = severity === 'high' ? ':red_circle:' : severity === 'medium' ? ':large_yellow_circle:' : ':large_green_circle:';
  const payload = {
    text: `${emoji} *[${severity.toUpperCase()}]* ${message}`,
    attachments: context
      ? [
          {
            color: severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'good',
            fields: Object.entries(context).map(([k, v]) => ({
              title: k,
              value: String(v),
              short: true,
            })),
          },
        ]
      : undefined,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn('[SlackAlert] Webhook POST returned non-OK', { status: res.status, severity });
    }
  } catch (err) {
    console.warn('[SlackAlert] POST failed', { error: err.message, severity });
  }
}

/**
 * Query D1 database via wrangler CLI
 */
function runWranglerQuery(sql) {
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

/**
 * Record cron run to cron_run_log table
 */
async function recordCronRun(status, error = null) {
  try {
    const now = Math.floor(Date.now() / 1000);
    // Use wrangler CLI to upsert (INSERT OR REPLACE)
    const sql = `
      INSERT INTO cron_run_log (cron_name, last_run_at, last_status, last_error, run_count)
      VALUES ('hash-chain-verification', ${now}, '${status}', ${error ? `'${escapeSql(error)}'` : 'NULL'}, 1)
      ON CONFLICT(cron_name) DO UPDATE SET
        last_run_at = excluded.last_run_at,
        last_status = excluded.last_status,
        last_error = excluded.last_error,
        run_count = cron_run_log.run_count + 1
    `;

    const result = spawnSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'sophia-raas-db', '--remote', '--command', sql],
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    if (result.status !== 0) {
      console.warn('[CronLog] Failed to record cron run:', result.stderr || result.stdout);
    } else {
      console.log('[CronLog] Recorded cron run:', { status, error: error || null });
    }
  } catch (err) {
    console.warn('[CronLog] Exception while recording:', err.message);
  }
}

function escapeSql(str) {
  return String(str).replace(/'/g, "''");
}

/**
 * Main verification logic
 */
async function main() {
  console.log('=== SOC 2 Hash Chain Verification ===');
  console.log(`Period: ${sinceDate.toISOString()} → now`);
  console.log(`Database: sophia-raas-db (remote)`);

  try {
    const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
    const sql = `
      SELECT id, action, license_nonce, user_id, ip_address, created_at,
             content_hash, previous_log_hash, hash_chain_valid
      FROM raas_audit_logs
      WHERE created_at >= ${sinceTimestamp}
      ORDER BY created_at ASC, id ASC;
    `;

    const logs = runWranglerQuery(sql);
    console.log(`Fetched ${logs.length} audit log entries`);

    if (logs.length === 0) {
      console.log('⚠️ No audit logs in period — nothing to verify');
      await recordCronRun('success');
      process.exit(0);
    }

    // Verification: recompute hash for each entry and verify chain linkage
    let previousHash = null;
    let firstInvalidIndex = null;
    let reason = null;
    let invalidCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Check 1: previous_log_hash links correctly
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

      // Check 3: Recompute content_hash to verify integrity
      const entry = {
        action: log.action,
        license_nonce: log.license_nonce || '',
        user_id: log.user_id || '',
        ip_address: log.ip_address || '',
        created_at: log.created_at,
      };

      const expectedHash = computeContentHash(entry, previousHash);
      if (log.content_hash !== expectedHash) {
        firstInvalidIndex = i;
        reason = `content_hash mismatch at index ${i}: expected "${expectedHash}", got "${log.content_hash}"`;
        invalidCount++;
        break;
      }

      // Check 4: hash_chain_valid flag (if 0, already marked invalid)
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

    // Record to cron_run_log for audit trail
    await recordCronRun(isValid ? 'success' : 'failure', reason);

    // Send Slack alert if chain is broken (SOC 2 CC7.2 critical)
    if (!isValid) {
      await sendSlackAlert('high', '🔴 Hash chain integrity check FAILED — SOC 2 CC7.2 potential compromise', {
        'First Invalid Index': firstInvalidIndex,
        'Reason': reason || 'Unknown',
        'Total Logs': logs.length,
        'Period': `${sinceDate.toISOString()} → now`,
        'Timestamp': new Date().toISOString(),
      }).catch(err => console.warn('[SlackAlert] Failed to send:', err.message));
      console.log(`\n❌ Hash chain INVALID — break at index ${firstInvalidIndex}: ${reason}`);
      console.log('Action: Investigate tampering, review audit logs, and document incident.');
      process.exit(1);
    } else {
      console.log('\n✅ Hash chain VALID — SOC 2 CC7.2 compliance verified');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);

    // Record error to cron_run_log
    await recordCronRun('error', error.message).catch(() => {});

    // Send Slack alert for script error
    await sendSlackAlert('high', '🔴 Hash chain verification script FAILED — check infrastructure', {
      'Error': error.message,
      'Timestamp': new Date().toISOString(),
    }).catch(() => {});

    process.exit(2);
  }
}

main();
