/** @vitest-environment node */

/**
 * Unit Test Suite: Sarbanes-Oxley (SOX) Section 404 Control Ledger & Quarantine Gate
 *
 * Validates:
 * 1. Real-time preventive manual adjustment quarantine gate (SOX-ITGC-02, SOX-FIN-01, SOX-FIN-02)
 * 2. Segregation of Duties (SoD) enforcement (preparer != approver)
 * 3. Double-entry balancing enforcement (debitCents == creditCents)
 * 4. Cryptographic token and dual-authorization verification
 * 5. Automated evaluation of all 6 canonical SOX 404 ICFR controls in clean and adverse states
 * 6. Adversarial injection of revenue variance, unbalanced eliminations, and non-GAAP tampering
 * 7. Management Attestation Certificate generation with bilingual statements and HMAC signatures
 *
 * @module tree/ipo/__tests__/sox404-control-ledger.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  SOX_CONTROL_IDS,
  type JournalAdjustmentInput,
} from '@/seed/types/ipo-filing';
import {
  validateManualAdjustment,
  recordQuarantineEventInDb,
  evaluateAllControls,
  generateCryptographicAttestation,
  sha256Sync,
} from '../sox404-control-ledger';

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

describe('SOX 404 Control Ledger & Quarantine Gate — Unit Tests', () => {
  describe('1. Real-Time Preventive Manual Adjustment Quarantine Gate', () => {
    it('quarantines unauthorized adjustments and identifies violated control SOX-ITGC-02', () => {
      const unauthorizedAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '4000-REVENUE',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 50_000_00,
        creditCents: 50_000_00,
        requestedBy: 'user_analyst_1',
        approvedBy: 'user_controller_1',
        reason: 'Manual adjustment to accelerate revenue',
        isAuthorized: false, // Explicitly unauthorized
        authorizationToken: 'AUTH_SEC_TOKEN_VALID_2026',
      };

      const result = validateManualAdjustment(unauthorizedAdj);

      expect(result.isAllowed).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT);
      expect(result.reason).toContain('Preventive quarantine enforced');
      expect(result.auditEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('enforces Segregation of Duties: quarantines when preparer approves own adjustment (SOX-FIN-01)', () => {
      const selfApprovedAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '5000-EXPENSE',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 20_000_00,
        creditCents: 20_000_00,
        requestedBy: 'user_cfo_exec',
        approvedBy: 'user_cfo_exec', // Preparer === Approver!
        reason: 'Emergency year-end accrual adjustment',
        isAuthorized: true,
        authorizationToken: 'AUTH_VALID_TOKEN_12345678',
      };

      const result = validateManualAdjustment(selfApprovedAdj);

      expect(result.isAllowed).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.SOD);
      expect(result.reason).toContain('Segregation of Duties violation');
    });

    it('quarantines when designated approver is missing', () => {
      const unapprovedAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '1000-CASH',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 10_000_00,
        creditCents: 10_000_00,
        requestedBy: 'user_clerk',
        approvedBy: undefined, // Missing approver
        reason: 'Petty cash reconciliation',
        isAuthorized: true,
        authorizationToken: 'AUTH_TOKEN_SECURE_987654321',
      };

      const result = validateManualAdjustment(unapprovedAdj);

      expect(result.isAllowed).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.SOD);
      expect(result.reason).toContain('Missing designated managerial approver');
    });

    it('enforces double-entry balance: quarantines when debits != credits (SOX-FIN-02)', () => {
      const unbalancedAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '1200-AR',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 100_000_00, // $100k debit
        creditCents: 90_000_00,  // $90k credit -> $10k discrepancy!
        requestedBy: 'user_accountant',
        approvedBy: 'user_controller',
        reason: 'Partial customer write-off',
        isAuthorized: true,
        authorizationToken: 'AUTH_TOKEN_BALANCED_12345678',
      };

      const result = validateManualAdjustment(unbalancedAdj);

      expect(result.isAllowed).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.INTERCOMPANY);
      expect(result.reason).toContain('Unbalanced journal entry');
    });

    it('quarantines when authorization token is missing or too short', () => {
      const shortTokenAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '2000-AP',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 5_000_00,
        creditCents: 5_000_00,
        requestedBy: 'user_accountant',
        approvedBy: 'user_controller',
        reason: 'Vendor invoice correction',
        isAuthorized: true,
        authorizationToken: 'short_token', // < 16 chars
      };

      const result = validateManualAdjustment(shortTokenAdj);

      expect(result.isAllowed).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT);
      expect(result.reason).toContain('minimum 16-character cryptographic token required');
    });

    it('permits compliant, authorized, dual-approved, balanced adjustments', () => {
      const compliantAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '6100-MARKETING',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 25_000_00,
        creditCents: 25_000_00,
        requestedBy: 'user_senior_accountant',
        approvedBy: 'user_finance_controller',
        reason: 'Quarter-end marketing accrual true-up',
        isAuthorized: true,
        authorizationToken: 'CRYPTO_TOKEN_APPROVED_SEC_2026',
      };

      const result = validateManualAdjustment(compliantAdj);

      expect(result.isAllowed).toBe(true);
      expect(result.quarantined).toBe(false);
      expect(result.violatedControlIds).toHaveLength(0);
      expect(result.reason).toContain('compliant under SOX 404');
    });

    it('computes synchronous deterministic SHA-256 evidence hashes', () => {
      const hash1 = sha256Sync('test_payload_1');
      const hash2 = sha256Sync('test_payload_1');
      const hash3 = sha256Sync('test_payload_2');

      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('2. Automated 6-Control Evaluation & Adversarial Invariance Testing', () => {
    let rawDb: InstanceType<typeof DatabaseSync>;
    let d1: D1Database;

    beforeEach(() => {
      rawDb = new DatabaseSync(':memory:');
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS financial_close_periods (
          id TEXT PRIMARY KEY,
          period_key TEXT NOT NULL,
          close_status TEXT NOT NULL,
          closed_by TEXT
        );

        CREATE TABLE IF NOT EXISTS revenue_schedules (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          total_contract_value_cents INTEGER NOT NULL,
          recognized_revenue_cents INTEGER NOT NULL,
          deferred_revenue_cents INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS multi_entity_consolidations (
          id TEXT PRIMARY KEY,
          consolidation_batch_id TEXT NOT NULL,
          entity_code TEXT NOT NULL,
          elimination_balanced INTEGER NOT NULL DEFAULT 1,
          zero_penny_leakage_verified INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS ipo_filing_periods (
          id TEXT PRIMARY KEY,
          period_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          merkle_root_hash TEXT,
          sec_filing_signature TEXT,
          gaap_net_income_cents INTEGER NOT NULL DEFAULT 0,
          depreciation_amortization_cents INTEGER NOT NULL DEFAULT 0,
          stock_based_compensation_cents INTEGER NOT NULL DEFAULT 0,
          unrealized_fx_gain_loss_cents INTEGER NOT NULL DEFAULT 0,
          one_time_mna_restructuring_cents INTEGER NOT NULL DEFAULT 0,
          adjusted_ebitda_cents INTEGER NOT NULL DEFAULT 0,
          gaap_operating_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
          capex_cents INTEGER NOT NULL DEFAULT 0,
          free_cash_flow_cents INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sox_404_control_matrix (
          id TEXT PRIMARY KEY,
          control_id TEXT NOT NULL UNIQUE,
          control_name TEXT NOT NULL,
          control_category TEXT NOT NULL,
          control_description_en TEXT NOT NULL,
          control_description_vi TEXT NOT NULL,
          coso_framework_pillar TEXT NOT NULL,
          assertion_tested TEXT NOT NULL,
          control_frequency TEXT NOT NULL,
          automation_level TEXT NOT NULL,
          is_preventive INTEGER NOT NULL DEFAULT 1,
          last_evaluated_at INTEGER,
          last_evaluation_status TEXT NOT NULL DEFAULT 'not_tested',
          unauthorized_attempts_detected INTEGER NOT NULL DEFAULT 0,
          quarantined_entries_count INTEGER NOT NULL DEFAULT 0,
          test_evidence_hash TEXT,
          last_tested_by TEXT NOT NULL DEFAULT 'SYSTEM_AUDITOR',
          remediation_plan TEXT,
          remediation_owner TEXT,
          remediation_deadline INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL DEFAULT 1700000000000,
          updated_at INTEGER NOT NULL DEFAULT 1700000000000
        );

        -- Seed 6 Canonical Controls
        INSERT INTO sox_404_control_matrix (
          id, control_id, control_name, control_category, control_description_en, control_description_vi,
          coso_framework_pillar, assertion_tested, control_frequency, automation_level, is_preventive, status
        ) VALUES
        ('c1', 'SOX-FIN-01', 'Segregation of Duties', 'SEGREGATION_OF_DUTIES', 'Desc EN', 'Desc VI', 'CONTROL_ACTIVITIES', 'ACCURACY', 'continuous_realtime', 'fully_automated', 1, 'active'),
        ('c2', 'SOX-FIN-02', 'Intercompany Balancing', 'FINANCIAL_REPORTING', 'Desc EN', 'Desc VI', 'CONTROL_ACTIVITIES', 'VALUATION', 'monthly_close', 'fully_automated', 1, 'active'),
        ('c3', 'SOX-FIN-03', 'ASC 606 Invariance', 'REVENUE_ASSURANCE', 'Desc EN', 'Desc VI', 'CONTROL_ACTIVITIES', 'COMPLETENESS', 'continuous_realtime', 'fully_automated', 1, 'active'),
        ('c4', 'SOX-ITGC-01', 'Cryptographic Audit Chain', 'ITGC', 'Desc EN', 'Desc VI', 'INFORMATION_COMMUNICATION', 'EXISTENCE', 'continuous_realtime', 'fully_automated', 1, 'active'),
        ('c5', 'SOX-ITGC-02', 'Quarantine Gate', 'ACCESS_CONTROL', 'Desc EN', 'Desc VI', 'CONTROL_ENVIRONMENT', 'RIGHTS_AND_OBLIGATIONS', 'continuous_realtime', 'fully_automated', 1, 'active'),
        ('c6', 'SOX-SEC-01', 'Regulation G Non-GAAP', 'FINANCIAL_REPORTING', 'Desc EN', 'Desc VI', 'MONITORING_ACTIVITIES', 'PRESENTATION_DISCLOSURE', 'quarterly', 'fully_automated', 1, 'active');

        -- Seed compliant clean baseline state
        INSERT INTO financial_close_periods (id, period_key, close_status, closed_by)
        VALUES ('fcp_clean', '2026-09', 'closed', 'user_authorized_cfo');

        INSERT INTO revenue_schedules (id, contract_id, total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents)
        VALUES ('rs_clean', 'CTR-2026-001', 120_000_00, 30_000_00, 90_000_00);

        INSERT INTO multi_entity_consolidations (id, consolidation_batch_id, entity_code, elimination_balanced, zero_penny_leakage_verified)
        VALUES ('mec_clean', 'batch_clean', 'CONSOLIDATED_GROUP', 1, 1);

        INSERT INTO ipo_filing_periods (
          id, period_key, status, merkle_root_hash, sec_filing_signature,
          gaap_net_income_cents, depreciation_amortization_cents, stock_based_compensation_cents,
          unrealized_fx_gain_loss_cents, one_time_mna_restructuring_cents, adjusted_ebitda_cents,
          gaap_operating_cash_flow_cents, capex_cents, free_cash_flow_cents
        ) VALUES (
          'ifp_clean', '2026-Q3', 'review_pending',
          'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
          'sig_clean_123',
          3_100_000_00, 350_000_00, 500_000_00, -50_000_00, 100_000_00, 4_000_000_00,
          4_200_000_00, 450_000_00, 3_750_000_00
        );
      `);

      d1 = makeD1(rawDb) as unknown as D1Database;
    });

    it('evaluates all 6 controls as effective and certifies clean when no violations exist', async () => {
      const summary = await evaluateAllControls(d1);

      expect(summary.totalControlsTested).toBe(6);
      expect(summary.effectiveControlsCount).toBe(6);
      expect(summary.deficienciesCount).toBe(0);
      expect(summary.overallStatus).toBe('certified_clean');
      expect(summary.merkleRootHash).toMatch(/^[a-f0-9]{64}$/);

      for (const ev of summary.evaluations) {
        expect(ev.isEffective).toBe(true);
        expect(ev.status).toBe('effective');
        expect(ev.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('adversarial test: detects ASC 606 revenue recognition discrepancy and flags material weakness', async () => {
      // Inject $10,000 revenue leak into revenue_schedules
      // Contract value = 100k, Recognized = 30k, Deferred = 60k -> Sum = 90k != 100k!
      rawDb.exec(`
        INSERT INTO revenue_schedules (id, contract_id, total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents)
        VALUES ('rs_leaked', 'CTR-LEAK-001', 100_000_00, 30_000_00, 60_000_00);
      `);

      const summary = await evaluateAllControls(d1);

      expect(summary.overallStatus).toBe('adverse_weakness');
      const revControl = summary.evaluations.find((e) => e.controlId === SOX_CONTROL_IDS.ASC606_REVENUE);
      expect(revControl).toBeDefined();
      expect(revControl?.isEffective).toBe(false);
      expect(revControl?.status).toBe('material_weakness');
      expect(revControl?.findings.some((f) => f.includes('CTR-LEAK-001'))).toBe(true);
    });

    it('adversarial test: detects unbalanced intercompany elimination and flags deficiency', async () => {
      // Inject unbalanced consolidation batch
      rawDb.exec(`
        UPDATE multi_entity_consolidations SET elimination_balanced = 0 WHERE entity_code = 'CONSOLIDATED_GROUP';
      `);

      const summary = await evaluateAllControls(d1);

      const intercompanyControl = summary.evaluations.find(
        (e) => e.controlId === SOX_CONTROL_IDS.INTERCOMPANY
      );
      expect(intercompanyControl).toBeDefined();
      expect(intercompanyControl?.isEffective).toBe(false);
      expect(intercompanyControl?.status).toBe('deficiency');
      expect(summary.overallStatus).toBe('qualified_deficiency');
    });

    it('records quarantine events in D1 and increments violation counters', async () => {
      const unauthorizedAdj: JournalAdjustmentInput = {
        periodKey: '2026-Q3',
        accountCode: '4000-REVENUE',
        entityCode: 'SOPHIA_GLOBAL_INC',
        debitCents: 50_000_00,
        creditCents: 50_000_00,
        requestedBy: 'rogue_agent',
        approvedBy: 'rogue_agent',
        reason: 'Unauthorized revenue inflation',
        isAuthorized: false,
      };

      const validation = validateManualAdjustment(unauthorizedAdj);
      expect(validation.quarantined).toBe(true);

      await recordQuarantineEventInDb(d1, validation);

      // Verify counter in D1 was incremented
      const row = rawDb
        .prepare('SELECT unauthorized_attempts_detected, quarantined_entries_count FROM sox_404_control_matrix WHERE control_id = ?')
        .get(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT) as Record<string, unknown>;

      expect(row.unauthorized_attempts_detected).toBe(1);
      expect(row.quarantined_entries_count).toBe(1);
    });

    it('generates a formal bilingual SOX 302/404 Management Attestation Certificate', async () => {
      const summary = await evaluateAllControls(d1);
      const certificate = await generateCryptographicAttestation(
        summary,
        'user_cfo_long',
        'CFO & Head of Financial Engineering',
        '2026-Q3'
      );

      expect(certificate.periodKey).toBe('2026-Q3');
      expect(certificate.certifierId).toBe('user_cfo_long');
      expect(certificate.soxStatus).toBe('certified_clean');
      expect(certificate.certificateId).toContain('SOX-CERT-2026-Q3');

      // Verify bilingual statements
      expect(certificate.statementEn).toContain('Section 302 and Section 404 of the Sarbanes-Oxley Act');
      expect(certificate.statementVi).toContain('Điều 302 và Điều 404 của Đạo luật Sarbanes-Oxley');

      // Verify digital signature and Merkle root
      expect(certificate.digitalSignature).toMatch(/^[a-f0-9]{64}$/);
      expect(certificate.merkleRootHash).toBe(summary.merkleRootHash);
    });
  });
});
