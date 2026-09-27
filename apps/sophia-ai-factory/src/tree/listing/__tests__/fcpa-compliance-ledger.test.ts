/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { FcpaComplianceLedger, type FcpaScreeningInput } from '../fcpa-compliance-ledger';

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

describe('FcpaComplianceLedger — Unit Tests', () => {
  let db: D1Database;

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS fcpa_compliance_screenings (
        id TEXT PRIMARY KEY,
        filing_period_id TEXT NOT NULL,
        counterparty_name TEXT NOT NULL,
        counterparty_jurisdiction TEXT NOT NULL,
        screening_type TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        disposition TEXT NOT NULL,
        reviewed_by TEXT NOT NULL,
        review_notes TEXT,
        immutable_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT '2026-09-27T00:00:00Z'
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. Risk Evaluation & Dispositions', () => {
    it('clears low-risk counterparties with zero red flags', () => {
      const input: FcpaScreeningInput = {
        filingPeriodId: 'period_2026',
        counterpartyName: 'Enterprise SaaS Corp US',
        counterpartyJurisdiction: 'US',
        screeningType: 'TRANSACTION_AUDIT',
      };

      const result = FcpaComplianceLedger.evaluateRisk(input);
      expect(result.riskScore).toBe(10);
      expect(result.disposition).toBe('CLEARED');
      expect(result.immutableHash).toHaveLength(64);
    });

    it('escalates to legal when PEP involvement is detected', () => {
      const input: FcpaScreeningInput = {
        filingPeriodId: 'period_2026',
        counterpartyName: 'State-Linked Procurement Agency',
        counterpartyJurisdiction: 'APAC',
        screeningType: 'PEP_CHECK',
        isPepInvolved: true,
      };

      const result = FcpaComplianceLedger.evaluateRisk(input);
      expect(result.riskScore).toBe(55);
      expect(result.disposition).toBe('ESCALATED_LEGAL');
      expect(result.reviewNotes).toContain('PEP involvement detected');
    });

    it('blocks counterparties with combined high-risk factors', () => {
      const input: FcpaScreeningInput = {
        filingPeriodId: 'period_2026',
        counterpartyName: 'Offshore Intermediary Corp',
        counterpartyJurisdiction: 'FATF_GREY_LIST',
        screeningType: 'BRIBERY_RISK',
        isPepInvolved: true,
        isHighRiskJurisdiction: true,
        unexplainedDiscountPct: 35,
      };

      const result = FcpaComplianceLedger.evaluateRisk(input);
      expect(result.riskScore).toBe(100);
      expect(result.disposition).toBe('BLOCKED');
      expect(result.reviewNotes).toContain('PEP involvement');
      expect(result.reviewNotes).toContain('Abnormal commission');
    });
  });

  describe('2. D1 Persistence and Retrieval', () => {
    it('records and queries screening audit records from D1', async () => {
      const input: FcpaScreeningInput = {
        filingPeriodId: 'period_2026',
        counterpartyName: 'Global Cloud Systems Ltd',
        counterpartyJurisdiction: 'SG',
        screeningType: 'SANCTIONS_OFAC',
      };

      const screening = FcpaComplianceLedger.conductScreening(input, 'test_fcpa_1');
      await FcpaComplianceLedger.recordScreening(db, screening);

      const records = await FcpaComplianceLedger.getScreeningsByPeriod(db, 'period_2026');
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('test_fcpa_1');
      expect(records[0].disposition).toBe('CLEARED');
      expect(records[0].immutableHash).toBe(screening.immutableHash);
    });
  });
});
