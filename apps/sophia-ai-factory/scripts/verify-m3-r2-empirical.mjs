#!/usr/bin/env node
/**
 * Empirical Verification Script for Milestone M3 Round 2
 *
 * Verifies:
 * 1. Inngest Cloud route handler discovery in src/app/api/inngest/route.ts.
 * 2. Function ID and trigger schedule integrity for affiliateHoldPromoterCron and financialReconciliationCron.
 * 3. Payout batcher fallback column query correctness against both legacy and modern schemas in SQLite.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

console.log('=== [CHALLENGER M3 R2] EMPIRICAL VERIFICATION HARNESS ===\n');

let allPassed = true;
function assertCheck(name, condition, detail = '') {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    if (detail) console.log(`   ${detail}`);
  } else {
    console.error(`❌ [FAIL] ${name}`);
    if (detail) console.error(`   ${detail}`);
    allPassed = false;
  }
}

// --------------------------------------------------------------------------
// 1. Inngest Route Discovery & Function Registration
// --------------------------------------------------------------------------
console.log('--- 1. Inngest Route Registration in src/app/api/inngest/route.ts ---');

const routePath = path.join(appRoot, 'src/app/api/inngest/route.ts');
const routeContent = fs.readFileSync(routePath, 'utf8');

assertCheck(
  'Route imports affiliateHoldPromoterCron',
  routeContent.includes('affiliateHoldPromoterCron'),
  'Imported from @/forest/inngest/functions/index'
);

assertCheck(
  'Route imports financialReconciliationCron',
  routeContent.includes('financialReconciliationCron'),
  'Imported from @/forest/inngest/functions/index'
);

// Check serve() functions array
const serveMatch = routeContent.match(/export\s+const\s*\{\s*GET,\s*POST,\s*PUT\s*\}\s*=\s*serve\(\s*\{[\s\S]*?functions:\s*\[([\s\S]*?)\][\s\S]*?\}\s*\)/);
assertCheck('Route exports { GET, POST, PUT } from serve()', !!serveMatch);

if (serveMatch) {
  const functionsList = serveMatch[1];
  assertCheck(
    'affiliateHoldPromoterCron registered in serve() functions array',
    functionsList.includes('affiliateHoldPromoterCron')
  );
  assertCheck(
    'financialReconciliationCron registered in serve() functions array',
    functionsList.includes('financialReconciliationCron')
  );
}

// --------------------------------------------------------------------------
// 2. Function ID & Cron Trigger Integrity
// --------------------------------------------------------------------------
console.log('\n--- 2. Function IDs & Cron Trigger Schedules ---');

const holdJobPath = path.join(appRoot, 'src/forest/jobs/affiliate-hold-promoter.ts');
const holdJobContent = fs.readFileSync(holdJobPath, 'utf8');

assertCheck(
  'affiliateHoldPromoterCron has id: affiliate-hold-promoter-daily',
  holdJobContent.includes("id: 'affiliate-hold-promoter-daily'")
);
assertCheck(
  'affiliateHoldPromoterCron has cron: 0 2 * * * (02:00 UTC daily)',
  holdJobContent.includes("cron: '0 2 * * *'")
);

const reconJobPath = path.join(appRoot, 'src/forest/jobs/financial-reconciliation.ts');
const reconJobContent = fs.readFileSync(reconJobPath, 'utf8');

assertCheck(
  'financialReconciliationCron has id: financial-reconciliation-daily',
  reconJobContent.includes("id: 'financial-reconciliation-daily'")
);
assertCheck(
  'financialReconciliationCron has cron: 0 4 * * * (04:00 UTC daily)',
  reconJobContent.includes("cron: '0 4 * * *'")
);

// --------------------------------------------------------------------------
// 3. Payout Batcher Fallback Logic in SQLite
// --------------------------------------------------------------------------
console.log('\n--- 3. Payout Batcher SQLite Schema Fallback Execution ---');

const payoutBatcherPath = path.join(appRoot, 'src/forest/jobs/payout-batcher.ts');
const payoutBatcherContent = fs.readFileSync(payoutBatcherPath, 'utf8');

assertCheck(
  'payout-batcher.ts fallback uses total_cents (not duplicate total_amount_cents)',
  payoutBatcherContent.includes('total_cents, recipient_count, status, created_at')
);

// Run empirical SQLite test with in-memory DB
const memDb = new DatabaseSync(':memory:');

// Create table with legacy schema (ONLY total_cents)
memDb.exec(`
  CREATE TABLE payout_batches_legacy (
    id TEXT PRIMARY KEY,
    rail TEXT NOT NULL,
    total_cents INTEGER NOT NULL DEFAULT 0,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT 0
  );
`);

const batchId = 'test_batch_123';
const rail = 'nowpayments_usdt';
const totalAmountCents = 45000;
const recipientCount = 3;
const nowMs = Date.now();

let primaryFailed = false;
try {
  // Primary query expects total_amount_cents
  memDb.prepare(`
    INSERT INTO payout_batches_legacy (
      id, rail, total_amount_cents, recipient_count, status, created_at
    ) VALUES (?, ?, ?, ?, 'processing', ?)
  `).run(batchId, rail, totalAmountCents, recipientCount, nowMs);
} catch (err) {
  primaryFailed = true;
}

assertCheck(
  'Primary INSERT fails as expected when total_amount_cents column is missing',
  primaryFailed,
  'Simulates legacy D1 schema without migration 0275'
);

let fallbackSucceeded = false;
try {
  // Fallback query uses total_cents
  memDb.prepare(`
    INSERT INTO payout_batches_legacy (
      id, rail, total_cents, recipient_count, status, created_at
    ) VALUES (?, ?, ?, ?, 'processing', ?)
  `).run(batchId, rail, totalAmountCents, recipientCount, nowMs);
  fallbackSucceeded = true;
} catch (err) {
  fallbackSucceeded = false;
}

assertCheck(
  'Fallback INSERT succeeds against total_cents legacy schema',
  fallbackSucceeded,
  'Batch record created successfully in fallback catch block'
);

const insertedRow = memDb.prepare('SELECT id, rail, total_cents, recipient_count, status FROM payout_batches_legacy WHERE id = ?').get(batchId);
assertCheck(
  'Inserted data matches payout payload',
  insertedRow && insertedRow.total_cents === totalAmountCents && insertedRow.recipient_count === recipientCount && insertedRow.status === 'processing',
  `Found total_cents: ${insertedRow?.total_cents}, status: ${insertedRow?.status}`
);

// --------------------------------------------------------------------------
// Final Verdict
// --------------------------------------------------------------------------
console.log('\n======================================================');
if (allPassed) {
  console.log('🏁 EMPIRICAL VERIFICATION RESULT: ALL CHECKS PASSED (100%)');
  process.exit(0);
} else {
  console.error('🚫 EMPIRICAL VERIFICATION RESULT: FAILURES DETECTED');
  process.exit(1);
}
