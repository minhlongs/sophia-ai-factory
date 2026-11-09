import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  runExperiment4CustomerActivationFunnel,
  runSophiaBench01DagBenchmark,
  runAllResearchExperiments,
} from '@/tree/verification/research-experiments-extended';
import {
  evaluateSparseDataGrowthGate,
  pruneBottomHookRetentionVariants,
  MIN_VERIFIED_CONVERSIONS_PER_MONTH,
  MIN_IMPRESSIONS_PER_VARIANT,
} from '@/tree/growth/sparse-data-growth-guard';
import { evaluateExperimentRowGrowthGate } from '@/forest/inngest/functions/experiment-feedback-helpers';
import {
  calculatePilotUnitEconomics,
  FOUNDER_SUPPORT_SLA_MAX_MINUTES_PER_MONTH,
  PAID_PILOT_14_DAY_GUARANTEED_VIDEOS,
  PAID_PILOT_14_DAY_PRICE_CENTS,
  PAID_PILOT_14_DAY_PRICE_VND,
  PAID_PILOT_DURATION_DAYS,
} from '@/tree/finance/pilot-unit-economics';
import { resolveStatusDiagnostics } from '@/app/api/open-core/status/status-diagnostics';

describe('Deliverable 1: EXP-04, SOPHIA-BENCH-01 & runAllResearchExperiments', () => {
  it('passes EXP-04 single-key BYOK onboarding & ValidationReceipt funnel deterministically', () => {
    const exp4 = runExperiment4CustomerActivationFunnel();
    expect(exp4.experimentId).toBe('EXP-04');
    expect(exp4.passed).toBe(true);
    expect(exp4.metrics.keyReductionPercent).toBe(80);
    expect(exp4.metrics.validationReceiptVerified).toBe(true);
  });

  it('passes SOPHIA-BENCH-01 9-step Inngest DAG step-8 fault recovery & token budget (<12,000)', () => {
    const bench = runSophiaBench01DagBenchmark();
    expect(bench.experimentId).toBe('SOPHIA-BENCH-01');
    expect(bench.passed).toBe(true);
    expect(bench.metrics.dagRetryAmplification).toBe(1.0);
    expect(bench.metrics.totalTokens).toBeLessThan(12000);
    expect(bench.metrics.stepCount).toBe(9);
  });

  it('aggregates all 6 research benchmarks (EXP-01..05 + SOPHIA-BENCH-01) with 100% pass rate', async () => {
    const suite = await runAllResearchExperiments();
    expect(suite.allPassed).toBe(true);
    expect(suite.results.map((r) => r.experimentId)).toEqual([
      'EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05', 'SOPHIA-BENCH-01',
    ]);
  });
});

describe('Deliverable 2: Sparse-Data Statistical Growth Guard & 72h 3s-Hook Retention Pruner', () => {
  it('blocks Thompson Sampling and Half-Kelly when conversions < 100 or impressions < 1,000', () => {
    const sparseConv = evaluateSparseDataGrowthGate({
      monthlyVerifiedConversions: 42,
      variantImpressions: [2500, 2600],
      accountAgeDays: 45,
    });
    expect(sparseConv.allowThompsonSampling).toBe(false);
    expect(sparseConv.allowHalfKellyAllocation).toBe(false);
    expect(sparseConv.mode).toBe('deterministic_rule_based');
    expect(sparseConv.reason).toContain('sparse conversions');

    const sparseImp = evaluateSparseDataGrowthGate({
      monthlyVerifiedConversions: 150,
      variantImpressions: [1200, 600],
      accountAgeDays: 45,
    });
    expect(sparseImp.allowThompsonSampling).toBe(false);
    expect(sparseImp.reason).toContain('sparse variant impressions');

    const ready = evaluateSparseDataGrowthGate({
      monthlyVerifiedConversions: MIN_VERIFIED_CONVERSIONS_PER_MONTH,
      variantImpressions: [MIN_IMPRESSIONS_PER_VARIANT, MIN_IMPRESSIONS_PER_VARIANT + 200],
      accountAgeDays: 45,
    });
    expect(ready.allowThompsonSampling).toBe(true);
    expect(ready.allowHalfKellyAllocation).toBe(true);
    expect(ready.mode).toBe('thompson_half_kelly');
  });

  it('prunes the bottom 25% 3s-hook retention variants after 72h and >= 1,000 views', () => {
    const pruneRes = pruneBottomHookRetentionVariants([
      { variantId: 'v_low', hookPatternId: 'h1', views: 1500, elapsedHours: 80, threeSecondHookRate: 0.18 },
      { variantId: 'v_mid1', hookPatternId: 'h2', views: 1500, elapsedHours: 80, threeSecondHookRate: 0.45 },
      { variantId: 'v_mid2', hookPatternId: 'h3', views: 1500, elapsedHours: 80, threeSecondHookRate: 0.58 },
      { variantId: 'v_high', hookPatternId: 'h4', views: 1500, elapsedHours: 80, threeSecondHookRate: 0.72 },
      { variantId: 'v_immature', hookPatternId: 'h5', views: 400, elapsedHours: 24, threeSecondHookRate: 0.10 },
    ]);
    expect(pruneRes.prunedVariantIds).toEqual(['v_low']);
    expect(pruneRes.keptVariantIds).toContain('v_high');
    expect(pruneRes.pendingEvaluationVariantIds).toEqual(['v_immature']);
  });

  it('evaluates experiment feedback cron rows via evaluateExperimentRowGrowthGate', () => {
    const decision = evaluateExperimentRowGrowthGate({
      id: 'exp_1',
      tenant_id: 'org_1',
      video_id: 'vid_1',
      content_type: 'short',
      variant_a_caption: 'A',
      variant_b_caption: 'B',
      variant_a_thumb_url: null,
      variant_b_thumb_url: null,
      impressions_a: 1200,
      impressions_b: 850,
      conversions_a: 25,
      conversions_b: 19,
      winner: 'a',
      decided_at: '2026-11-09T00:00:00Z',
    });
    expect(decision.allowThompsonSampling).toBe(false);
    expect(decision.mode).toBe('deterministic_rule_based');
  });
});

describe('Deliverable 3: 14-Day Paid Pilot Package, <=90m SLA & /api/open-core/status Diagnostics', () => {
  it('enforces 14-day Paid Pilot constants (1,990,000 VND / $79 / 10 videos) and <=90m Founder SLA', () => {
    expect(PAID_PILOT_DURATION_DAYS).toBe(14);
    expect(PAID_PILOT_14_DAY_PRICE_VND).toBe(1990000);
    expect(PAID_PILOT_14_DAY_PRICE_CENTS).toBe(7900);
    expect(PAID_PILOT_14_DAY_GUARANTEED_VIDEOS).toBe(10);
    expect(FOUNDER_SUPPORT_SLA_MAX_MINUTES_PER_MONTH).toBe(90);

    const withinSla = calculatePilotUnitEconomics({
      pilotId: 'pilot_1',
      orgId: 'org_1',
      periodKey: '2026-11',
      tier: 'BASIC',
      collectedSubscriptionCents: PAID_PILOT_14_DAY_PRICE_CENTS,
      paymentGatewayFeeCents: 158,
      cloudflareEdgeCostCents: 200,
      founderSupportMinutes: 90,
    });
    expect(withinSla.ok).toBe(true);
    if (withinSla.ok) {
      expect(withinSla.value.founderSupportSlaBreached).toBe(false);
      expect(withinSla.value.founderSupportSlaCeilingMinutes).toBe(90);
    }

    const breachedSla = calculatePilotUnitEconomics({
      pilotId: 'pilot_2',
      orgId: 'org_1',
      periodKey: '2026-11',
      tier: 'BASIC',
      collectedSubscriptionCents: PAID_PILOT_14_DAY_PRICE_CENTS,
      paymentGatewayFeeCents: 158,
      cloudflareEdgeCostCents: 200,
      founderSupportMinutes: 91,
    });
    expect(breachedSla.ok).toBe(true);
    if (breachedSla.ok) {
      expect(breachedSla.value.founderSupportSlaBreached).toBe(true);
    }
  });

  it('resolves live status diagnostics for /api/open-core/status?pilot=true&experiments=true', async () => {
    const diag = await resolveStatusDiagnostics({
      userId: 'usr_pilot_01',
      userTier: 'BASIC',
      localShortSha: '07bff6cb',
      includePilot: true,
      includeExperiments: true,
    });
    expect(diag.paidPilotPackage.priceVnd).toBe(1990000);
    expect(diag.paidPilotPackage.priceUsdCents).toBe(7900);
    expect(diag.pilotReadiness?.zeroDefectVerified).toBe(true);
    expect(diag.pilotUnitEconomics?.founderSupportSlaBreached).toBe(false);
    expect(diag.experimentsAudit?.allPassed).toBe(true);
  });
});

describe('Deliverable 4: Gate G0–G13 & PoC 01 Evidence Artifacts Verification', () => {
  it('validates existence and schema of .artifacts/g0-baseline.json and .artifacts/poc-01-payos-idempotency/*', () => {
    const root = process.cwd();
    const g0Path = path.join(root, '.artifacts', 'g0-baseline.json');
    const pocDir = path.join(root, '.artifacts', 'poc-01-payos-idempotency');

    expect(fs.existsSync(g0Path)).toBe(true);
    const g0 = JSON.parse(fs.readFileSync(g0Path, 'utf8')) as {
      gate: string;
      liveProduction: { parityVerified: boolean };
    };
    expect(g0.gate).toBe('G0_DISCOVERY_FIRST_BASELINE_LOCK');
    expect(g0.liveProduction.parityVerified).toBe(true);

    for (const file of ['G0_BASELINE_LOCK.json', 'G2_THREAT_MODEL.md', 'G5_G6_G7_TEST_RESULTS.json', 'G12_ROLLBACK_PLAN.md']) {
      expect(fs.existsSync(path.join(pocDir, file))).toBe(true);
    }
  });
});
