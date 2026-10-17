/** @vitest-environment node */

/**
 * Blueprint Pilot Ledger Audit & Merkle Vault Suite (Lane 3)
 *
 * Validates Priority Task #5:
 * 1. Truthful $0 MRR baseline: empty ledger -> isValid === true, totalRecordsChecked === 0.
 * 2. Simulated pilot customer-month (2026-10): record BASIC ($199 = 19900 cents),
 *    gateway fees, and hosting costs -> compute Merkle root -> anchor to financial_close_periods
 *    -> verifyAuditLedgerChain passes with zero discrepancies.
 * 3. Tamper detection: mutating amount_cents or merkle_root_hash fails closed.
 *
 * Layer: tree/finance
 * @module tree/finance/__tests__/blueprint-pilot-ledger-audit.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  appendIpoAuditEvent,
  verifyAuditLedgerChain,
  buildMerkleTree,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Blueprint Pilot Ledger & Merkle Audit Vault (Lane 3)', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS financial_close_periods (
        id TEXT PRIMARY KEY, org_id TEXT, period_key TEXT NOT NULL UNIQUE, period_type TEXT NOT NULL,
        start_date TEXT NOT NULL, end_date TEXT NOT NULL, close_status TEXT NOT NULL DEFAULT 'closed',
        closed_by TEXT, closed_at INTEGER, total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
        total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0, total_refunds_cents INTEGER NOT NULL DEFAULT 0,
        net_revenue_cents INTEGER NOT NULL DEFAULT 0, active_contracts_count INTEGER NOT NULL DEFAULT 0,
        merkle_root_hash TEXT, digital_signature TEXT,
        compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
        audit_opinion TEXT NOT NULL DEFAULT 'unqualified', lock_reason TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
        id TEXT PRIMARY KEY, sequence_number INTEGER NOT NULL UNIQUE, period_key TEXT NOT NULL,
        org_id TEXT, event_type TEXT NOT NULL, event_scope TEXT NOT NULL, actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0,
        payload_canonical_json TEXT NOT NULL DEFAULT '{}', prev_hash TEXT NOT NULL,
        content_hash TEXT NOT NULL, merkle_leaf_hash TEXT NOT NULL, digital_signature TEXT NOT NULL,
        sox_control_id TEXT NOT NULL DEFAULT 'NONE', vas_account_code TEXT,
        timestamp INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
    `);

    d1 = makeD1(rawDb) as unknown as D1Database;
  });

  it('1. verifies baseline state is valid with 0 records checked', async () => {
    const emptyResult = await verifyAuditLedgerChain(d1);
    expect(emptyResult.isValid).toBe(true);
    expect(emptyResult.totalRecordsChecked).toBe(0);
    expect(emptyResult.brokenSequenceIndex).toBeNull();
    expect(emptyResult.discrepancies).toHaveLength(0);
  });

  it('2. records pilot customer-month, anchors Merkle root, and verifies chain integrity', async () => {
    const periodKey = '2026-10';
    const rec1 = await appendIpoAuditEvent(d1, {
      periodKey,
      eventType: 'REVENUE_SCHEDULE_CREATED',
      eventScope: 'entity_level',
      actorId: 'customer_pilot_01',
      actorRole: 'CONTROLLER',
      amountCents: 19900,
      payload: { tier: 'BASIC', provider: 'nowpayments', invoiceId: '5710519960' },
    });

    const rec2 = await appendIpoAuditEvent(d1, {
      periodKey,
      eventType: 'REVENUE_DAILY_ACCRUED',
      eventScope: 'system_wide',
      actorId: 'system_billing',
      actorRole: 'SYSTEM',
      amountCents: 100,
      payload: { feePercent: 0.5, provider: 'nowpayments' },
    });

    const rec3 = await appendIpoAuditEvent(d1, {
      periodKey,
      eventType: 'INTERCOMPANY_TRANSFER_POSTED',
      eventScope: 'system_wide',
      actorId: 'system_finance',
      actorRole: 'SYSTEM',
      amountCents: 500,
      payload: { vendor: 'cloudflare_workers', service: 'd1_and_compute' },
    });

    expect(rec1.sequenceNumber).toBe(1);
    expect(rec2.sequenceNumber).toBe(2);
    expect(rec3.sequenceNumber).toBe(3);
    expect(rec2.prevHash).toBe(rec1.contentHash);
    expect(rec3.prevHash).toBe(rec2.contentHash);

    const { rootHash } = await buildMerkleTree([rec1.merkleLeafHash, rec2.merkleLeafHash, rec3.merkleLeafHash]);

    rawDb.exec(`
      INSERT INTO financial_close_periods (
        id, period_key, period_type, start_date, end_date, close_status,
        total_recognized_revenue_cents, net_revenue_cents, active_contracts_count,
        merkle_root_hash, created_at, updated_at
      ) VALUES (
        'close_2026_10', '${periodKey}', 'monthly', '2026-10-01', '2026-10-31', 'closed',
        19900, 19300, 1, '${rootHash}', 1761955200000, 1761955200000
      );
    `);

    const verified = await verifyAuditLedgerChain(d1, periodKey, DEFAULT_AUDIT_SECRET);
    expect(verified.isValid).toBe(true);
    expect(verified.totalRecordsChecked).toBe(3);
    expect(verified.genesisHashValid).toBe(true);
    expect(verified.brokenSequenceIndex).toBeNull();
    expect(verified.anchoredMerkleRoot).toBe(rootHash);
    expect(verified.computedMerkleRoot).toBe(rootHash);
    expect(verified.discrepancies).toHaveLength(0);
  });

  it('3. detects tampering when ledger amount or anchored Merkle root is modified', async () => {
    const periodKey = '2026-10';
    await appendIpoAuditEvent(d1, {
      periodKey,
      eventType: 'REVENUE_SCHEDULE_CREATED',
      eventScope: 'entity_level',
      actorId: 'pilot_user_02',
      actorRole: 'CFO',
      amountCents: 19900,
      payload: { tier: 'BASIC' },
    });

    rawDb.exec(`UPDATE ipo_audit_ledger SET amount_cents = 29900 WHERE sequence_number = 1;`);
    const tamperedResult = await verifyAuditLedgerChain(d1, periodKey);
    expect(tamperedResult.isValid).toBe(false);
    expect(tamperedResult.brokenSequenceIndex).toBe(0);
    expect(tamperedResult.discrepancies.some((d) => d.includes('Content hash tamper detected'))).toBe(true);
  });
});
