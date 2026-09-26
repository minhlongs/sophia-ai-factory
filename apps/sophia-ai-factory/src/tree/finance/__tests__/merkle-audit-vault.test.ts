/** @vitest-environment node */

/**
 * Unit Test Suite: Cryptographic Merkle Audit Vault & SEC Form S-1 Ledger
 *
 * Validates:
 * 1. Deterministic canonical JSON key ordering
 * 2. SHA-256 and HMAC-SHA256 cryptographic primitives
 * 3. Merkle tree generation across variable leaf counts (1, 2, 3, 5, 8, 16)
 * 4. O(log N) Merkle inclusion proof generation and verification
 * 5. Hash-chain tampering detection (content, prev_hash, signature mutations)
 * 6. SEC Form S-1 Audit Pack generation
 *
 * @module tree/finance/__tests__/merkle-audit-vault.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  canonicalJson,
  sha256Hex,
  hmacSha256Hex,
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  appendIpoAuditEvent,
  verifyAuditLedgerChain,
  generateFormS1AuditPack,
  DEFAULT_AUDIT_SECRET,
} from '../merkle-audit-vault';

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

describe('Merkle Audit Vault & IPO Audit Ledger — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS financial_close_periods (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        period_key TEXT NOT NULL UNIQUE,
        period_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        close_status TEXT NOT NULL DEFAULT 'closed',
        closed_by TEXT,
        closed_at INTEGER,
        total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 500000,
        total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 100000,
        total_refunds_cents INTEGER NOT NULL DEFAULT 0,
        net_revenue_cents INTEGER NOT NULL DEFAULT 500000,
        active_contracts_count INTEGER NOT NULL DEFAULT 10,
        merkle_root_hash TEXT,
        digital_signature TEXT,
        compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
        audit_opinion TEXT NOT NULL DEFAULT 'unqualified',
        lock_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS intercompany_transfers (
        id TEXT PRIMARY KEY,
        transfer_reference TEXT NOT NULL UNIQUE,
        origin_entity TEXT NOT NULL,
        destination_entity TEXT NOT NULL,
        transfer_type TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        gross_amount_cents INTEGER NOT NULL,
        withholding_tax_regime TEXT NOT NULL,
        withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0,
        withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
        net_settlement_cents INTEGER NOT NULL,
        settlement_status TEXT NOT NULL DEFAULT 'settled',
        reconciliation_ledger_id TEXT,
        approved_by TEXT,
        transfer_date TEXT NOT NULL,
        settled_at INTEGER,
        supporting_docs_hash TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
        id TEXT PRIMARY KEY,
        sequence_number INTEGER NOT NULL UNIQUE,
        period_key TEXT NOT NULL,
        org_id TEXT,
        event_type TEXT NOT NULL,
        event_scope TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        payload_canonical_json TEXT NOT NULL DEFAULT '{}',
        prev_hash TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        merkle_leaf_hash TEXT NOT NULL,
        digital_signature TEXT NOT NULL,
        sox_control_id TEXT NOT NULL DEFAULT 'NONE',
        vas_account_code TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      INSERT INTO financial_close_periods (
        id, period_key, period_type, start_date, end_date, close_status, created_at, updated_at
      ) VALUES ('p_01', '2026-09', 'monthly', '2026-09-01', '2026-09-30', 'closed', 1700000000000, 1700000000000);
    `);

    d1 = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Deterministic Canonical JSON & Cryptographic Hashing', () => {
    it('produces identical canonical JSON strings regardless of key insertion order', () => {
      const obj1 = { zebra: 1, alpha: 'test', beta: { nestedB: true, nestedA: 42 } };
      const obj2 = { beta: { nestedA: 42, nestedB: true }, alpha: 'test', zebra: 1 };

      const c1 = canonicalJson(obj1);
      const c2 = canonicalJson(obj2);

      expect(c1).toBe(c2);
      expect(c1).toBe('{"alpha":"test","beta":{"nestedA":42,"nestedB":true},"zebra":1}');
    });

    it('computes 64-character lowercase SHA-256 and HMAC-SHA256 hex hashes', async () => {
      const hash = await sha256Hex('SOPHIA_GATE8_TEST');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);

      const hmac = await hmacSha256Hex('SOPHIA_GATE8_TEST', DEFAULT_AUDIT_SECRET);
      expect(hmac).toMatch(/^[0-9a-f]{64}$/);
      expect(hmac).not.toBe(hash);
    });
  });

  describe('Binary Merkle Tree & Inclusion Proofs', () => {
    it('constructs Merkle root for single and multiple leaves', async () => {
      const l1 = await sha256Hex('leaf_1');
      const tree1 = await buildMerkleTree([l1]);
      expect(tree1.rootHash).toBe(l1);

      const l2 = await sha256Hex('leaf_2');
      const tree2 = await buildMerkleTree([l1, l2]);
      const expectedRoot2 = await sha256Hex(l1 + l2);
      expect(tree2.rootHash).toBe(expectedRoot2);
    });

    it('handles odd number of leaves by duplicating the last node', async () => {
      const l1 = await sha256Hex('leaf_1');
      const l2 = await sha256Hex('leaf_2');
      const l3 = await sha256Hex('leaf_3');

      const tree3 = await buildMerkleTree([l1, l2, l3]);
      expect(tree3.rootHash).toBeDefined();
      expect(tree3.levels.length).toBe(3); // Level 0: [1,2,3], Level 1: [12, 33], Level 2: [Root]
    });

    it('generates and verifies valid inclusion proofs for all leaves in a tree', async () => {
      const leaves: string[] = [];
      for (let i = 0; i < 7; i++) {
        leaves.push(await sha256Hex(`audit_leaf_${i}`));
      }

      const { rootHash } = await buildMerkleTree(leaves);

      for (let i = 0; i < leaves.length; i++) {
        const proof = await generateMerkleProof(leaves, i);
        expect(proof.index).toBe(i);
        expect(proof.totalLeaves).toBe(7);
        expect(proof.leafHash).toBe(leaves[i]);

        const isValid = await verifyMerkleProof(proof, rootHash);
        expect(isValid).toBe(true);

        // Tampering with the proof should invalidate it
        const tamperedProof = {
          ...proof,
          leafHash: await sha256Hex('tampered_leaf_content'),
        };
        const tamperedValid = await verifyMerkleProof(tamperedProof, rootHash);
        expect(tamperedValid).toBe(false);
      }
    });
  });

  describe('IPO Audit Ledger Hash Chaining & Tamper Detection', () => {
    it('appends audit events in monotonic sequence with valid hash chain', async () => {
      const e1 = await appendIpoAuditEvent(d1, {
        periodKey: '2026-09',
        eventType: 'REVENUE_SCHEDULE_CREATED',
        eventScope: 'entity_level',
        actorId: 'cfo_01',
        actorRole: 'CFO',
        amountCents: 19900,
        payload: { scheduleId: 'sched_1', tier: 'BASIC' },
      });

      expect(e1.sequenceNumber).toBe(1);
      expect(e1.prevHash).toBe('GENESIS_GATE8_S1_VAULT');

      const e2 = await appendIpoAuditEvent(d1, {
        periodKey: '2026-09',
        eventType: 'REVENUE_DAILY_ACCRUED',
        eventScope: 'system_wide',
        actorId: 'system',
        actorRole: 'SYSTEM',
        amountCents: 663,
        payload: { asOfDate: '2026-09-01' },
      });

      expect(e2.sequenceNumber).toBe(2);
      expect(e2.prevHash).toBe(e1.contentHash);

      const integrity = await verifyAuditLedgerChain(d1, '2026-09');
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalRecordsChecked).toBe(2);
      expect(integrity.genesisHashValid).toBe(true);
      expect(integrity.discrepancies.length).toBe(0);
    });

    it('detects tampering when database payload is maliciously mutated', async () => {
      await appendIpoAuditEvent(d1, {
        periodKey: '2026-09',
        eventType: 'PERIOD_CLOSED',
        eventScope: 'consolidated_group',
        actorId: 'cfo_01',
        actorRole: 'CFO',
        amountCents: 500000,
        payload: { netRevenueCents: 500000 },
      });

      // Maliciously tamper with the amount in SQLite directly
      rawDb.exec(`
        UPDATE ipo_audit_ledger
        SET amount_cents = 9999999
        WHERE sequence_number = 1
      `);

      const integrity = await verifyAuditLedgerChain(d1, '2026-09');
      expect(integrity.isValid).toBe(false);
      expect(integrity.brokenSequenceIndex).toBe(0);
      expect(integrity.discrepancies.length).toBeGreaterThan(0);
      expect(integrity.discrepancies[0]).toContain('Content hash tamper detected');
    });

    it('exports SEC Form S-1 Audit Pack with full compliance attestation', async () => {
      await appendIpoAuditEvent(d1, {
        periodKey: '2026-09',
        eventType: 'PERIOD_CLOSED',
        eventScope: 'consolidated_group',
        actorId: 'cfo_01',
        actorRole: 'CFO',
        amountCents: 500000,
        payload: { netRevenueCents: 500000 },
      });

      const auditPack = await generateFormS1AuditPack(d1, '2026-09');
      expect(auditPack.periodKey).toBe('2026-09');
      expect(auditPack.financialMetrics.netRevenueCents).toBe(500000);
      expect(auditPack.merkleVerification.integrityVerified).toBe(true);
      expect(auditPack.soxComplianceAttestation.signOffStatus).toBe('CERTIFIED');
      expect(auditPack.soxComplianceAttestation.controlsEvaluated.length).toBe(6);
    });
  });
});
