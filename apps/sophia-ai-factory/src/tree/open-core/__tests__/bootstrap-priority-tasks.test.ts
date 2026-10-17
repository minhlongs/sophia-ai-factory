/** @vitest-environment node */

/**
 * Comprehensive Test Suite for Bootstrap Priority Tasks (#1–#5)
 * Layer: tree/open-core/__tests__
 * @module tree/open-core/__tests__/bootstrap-priority-tasks.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import { evaluateDiscoveryInterview, synthesizeObjectionMatrix } from '../discovery-interview-evaluator';
import { evaluatePilotReadiness, MANDATORY_PILOT_STEPS, type PilotJourneyState } from '../pilot-onboarding-tracker';
import { calculatePilotUnitEconomics, recordAndVerifyPilotClosePeriod, type PilotUnitEconomicsInput } from '../../finance/pilot-unit-economics';
import { verifyAuditLedgerChain } from '../../finance/merkle/chain-verifier';

interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): { changes: number } };
}

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };

function createTestDb(): { rawDb: SqliteDb; d1: D1Database } {
  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS financial_close_periods (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT, period_key TEXT NOT NULL,
      period_type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, close_status TEXT NOT NULL DEFAULT 'closed',
      closed_by TEXT, closed_at INTEGER, total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
      total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0, total_refunds_cents INTEGER NOT NULL DEFAULT 0,
      net_revenue_cents INTEGER NOT NULL DEFAULT 0, active_contracts_count INTEGER NOT NULL DEFAULT 0,
      merkle_root_hash TEXT, digital_signature TEXT, compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,VAS_TT200,SOX_404',
      audit_opinion TEXT NOT NULL DEFAULT 'unqualified', lock_reason TEXT, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, UNIQUE(org_id, period_key)
    );
    CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
      id TEXT PRIMARY KEY, sequence_number INTEGER NOT NULL UNIQUE, period_key TEXT NOT NULL, org_id TEXT,
      event_type TEXT NOT NULL, event_scope TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0, payload_canonical_json TEXT NOT NULL DEFAULT '{}',
      prev_hash TEXT NOT NULL, content_hash TEXT NOT NULL, merkle_leaf_hash TEXT NOT NULL,
      digital_signature TEXT NOT NULL, sox_control_id TEXT NOT NULL DEFAULT 'NONE', vas_account_code TEXT,
      timestamp INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
  `);
  return { rawDb, d1: makeD1(rawDb as unknown as Parameters<typeof makeD1>[0]) as unknown as D1Database };
}

describe('Bootstrap Priority Tasks (#1–#5) Suite', () => {
  it('Task #1: 5 qualified VN prospects & rubric score range guard', () => {
    const prospects = ['Alpha Agency', 'Beta SMB', 'Gamma Agency', 'Delta Creator', 'Epsilon Agency'].map((name, i) => {
      const res = evaluateDiscoveryInterview({
        interviewId: `int-00${i + 1}`, prospectName: name, segment: i % 2 === 0 ? 'vn_agency' : 'vn_smb',
        conductedAt: '2026-10-17T09:00:00Z', videoBottleneckScore: 18, currentToolSpendScore: 16,
        byokReadinessScore: 17, willingnessToPayMonthlyUsd: 199 + i * 150, cloudVsSelfHostPreference: 'cloud',
        rawObjections: ['pricing', 'data_privacy'],
      });
      expect(res.ok).toBe(true);
      return res.ok ? res.value : null;
    }).filter((v): v is NonNullable<typeof v> => v !== null);

    expect(prospects).toHaveLength(5);
    const summary = synthesizeObjectionMatrix(prospects);
    expect(summary.pilotReadinessQualified).toBe(true);
    expect(summary.qualifiedCount).toBe(5);
    expect(summary.dominantObjection).toBe('pricing');

    const badScore = evaluateDiscoveryInterview({
      interviewId: 'int-bad', prospectName: 'Bad', segment: 'vn_agency', conductedAt: '2026-10-17T09:00:00Z',
      videoBottleneckScore: 25, currentToolSpendScore: 10, byokReadinessScore: 10, willingnessToPayMonthlyUsd: 199,
      cloudVsSelfHostPreference: 'cloud', rawObjections: [],
    });
    expect(badScore.ok).toBe(false);
    if (!badScore.ok) expect(badScore.error.code).toBe('INVALID_SCORE_RANGE');
  });

  it('Task #2 & #3: 6-step pilot readiness, valid providers, defect URL, and SHA format', async () => {
    const base: PilotJourneyState = {
      customerId: 'cust-vn-01', liveEdgeShortSha: 'a1b2c3d', paymentProvider: 'nowpayments',
      activatedTier: 'PREMIUM', byokEncryptedInD1: true, configuredProviders: ['openrouter'],
      steps: MANDATORY_PILOT_STEPS.map((stepKey) => ({ stepKey, status: 'passed' as const })),
    };
    const npRes = await evaluatePilotReadiness(base);
    expect(npRes.ok).toBe(true);
    if (npRes.ok) {
      expect(npRes.value.completionPercentage).toBe(100);
      expect(npRes.value.zeroDefectVerified).toBe(true);
    }

    const payosRes = await evaluatePilotReadiness({ ...base, paymentProvider: 'payos' });
    expect(payosRes.ok).toBe(true);

    for (const prov of ['polar', 'paypal']) {
      const banned = await evaluatePilotReadiness({ ...base, paymentProvider: prov });
      expect(banned.ok).toBe(false);
      if (!banned.ok) expect(banned.error.code).toBe('BANNED_PAYMENT_PROVIDER');
    }

    const defect = await evaluatePilotReadiness({
      ...base,
      steps: MANDATORY_PILOT_STEPS.map((s) => ({ stepKey: s, status: s === 'telegram_bot_linked' ? 'failed' : 'passed' })),
    });
    expect(defect.ok).toBe(false);
    if (!defect.ok) expect(defect.error.code).toBe('DEFECT_TRACKING_REQUIRED');

    const badSha = await evaluatePilotReadiness({ ...base, liveEdgeShortSha: 'xyz' });
    expect(badSha.ok).toBe(false);
    if (!badSha.ok) expect(badSha.error.code).toBe('INVALID_EDGE_SHA');
  });

  it('Task #5: unit economics, D1 Merkle anchoring, invalid currency, and tamper detection', async () => {
    const input: PilotUnitEconomicsInput = {
      pilotId: 'pilot-001', orgId: 'org-vn-01', periodKey: '2026-10', tier: 'ENTERPRISE',
      collectedSubscriptionCents: 79900, paymentGatewayFeeCents: 1598, cloudflareEdgeCostCents: 500,
      founderSupportMinutes: 60, founderHourlyRateCents: 5000,
    };
    const calc = calculatePilotUnitEconomics(input);
    expect(calc.ok).toBe(true);
    if (calc.ok) expect(calc.value.netContributionCents).toBe(79900 - 1598 - 500 - 5000);

    const zeroRes = calculatePilotUnitEconomics({ ...input, collectedSubscriptionCents: 0 });
    expect(zeroRes.ok).toBe(false);
    if (!zeroRes.ok) expect(zeroRes.error.code).toBe('INVALID_CURRENCY_AMOUNT');
    const floatRes = calculatePilotUnitEconomics({ ...input, paymentGatewayFeeCents: 12.34 });
    expect(floatRes.ok).toBe(false);
    if (!floatRes.ok) expect(floatRes.error.code).toBe('INVALID_CURRENCY_AMOUNT');

    const { rawDb, d1 } = createTestDb();
    const anchorRes = await recordAndVerifyPilotClosePeriod(d1, input, 'user-cfo-01');
    expect(anchorRes.ok).toBe(true);
    if (anchorRes.ok) expect(anchorRes.value.integrity.isValid).toBe(true);

    rawDb.exec(`UPDATE ipo_audit_ledger SET amount_cents = 99999 WHERE sequence_number = 1;`);
    const tampered = await verifyAuditLedgerChain(d1, '2026-10');
    expect(tampered.isValid).toBe(false);
    const tamperedClose = await recordAndVerifyPilotClosePeriod(d1, input, 'user-cfo-01');
    expect(tamperedClose.ok).toBe(false);
    if (!tamperedClose.ok) expect(tamperedClose.error.code).toBe('MERKLE_CHAIN_TAMPERED');
  });
});
