import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSafeIntegerMicroUsd,
  buildBenchmarkReport,
  buildBlindEvaluationPackets,
  buildSensitivityScenarios,
  computeContributionPerAcceptedDeliverable,
  computeCostPerAcceptedDeliverable,
  computePercentile,
  computeWilsonInterval,
  formatMicroUsdAsUsd,
  renderBenchmarkReportMarkdown,
  runPairedFixtureBenchmark,
  verifyFrozenDataset,
  verifyFrozenRubric,
  type ExperimentConfig,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = resolve(process.cwd(), 'eval/b4-first-value');

describe('B4 Economic Telemetry, Unit Economics & Deterministic Reporting', () => {
  it('enforces safe integer micro-USD arithmetic and prevents float rounding drift', () => {
    expect(assertSafeIntegerMicroUsd(1_250_000, 'cost')).toBe(1_250_000);
    expect(formatMicroUsdAsUsd(1_250_000)).toBe('$1.250000');
    expect(formatMicroUsdAsUsd(-45_000)).toBe('-$0.045000');
    expect(() => assertSafeIntegerMicroUsd(1.5, 'cost')).toThrow(/safe integer/);
  });

  it('handles zero denominator safely for cost per accepted deliverable', () => {
    const zeroAccepted = computeCostPerAcceptedDeliverable(500_000, 0);
    expect(zeroAccepted.status).toBe('UNDEFINED_ZERO_ACCEPTED');
    expect(zeroAccepted.microUsd).toBeNull();

    const valid = computeCostPerAcceptedDeliverable(500_000, 4);
    expect(valid).toEqual({ status: 'COMPUTED', microUsd: 125_000 });
  });

  it('reports NOT_ESTABLISHED for contribution margin when no real customer revenue exists', () => {
    expect(computeContributionPerAcceptedDeliverable(null, 200_000, 10).status).toBe('NOT_ESTABLISHED');
    expect(computeContributionPerAcceptedDeliverable(0, 200_000, 10).status).toBe('NOT_ESTABLISHED');

    const established = computeContributionPerAcceptedDeliverable(5_000_000, 1_000_000, 4);
    expect(established).toEqual({ status: 'ESTABLISHED', contributionPerAcceptedMicroUsd: 1_000_000 });
  });

  it('computes p50/p95 percentiles and 95% Wilson confidence intervals accurately', () => {
    expect(computePercentile([], 50).status).toBe('NOT_MEASURED');
    expect(computePercentile([100, 200, 300, 400, 500], 50)).toEqual({ status: 'OBSERVED', value: 300 });
    expect(computePercentile([100, 200, 300, 400, 500], 95)).toEqual({ status: 'OBSERVED', value: 500 });

    expect(computeWilsonInterval(0, 0).status).toBe('INSUFFICIENT_DATA');
    const ci = computeWilsonInterval(80, 100);
    expect(ci.status).toBe('COMPUTED');
    expect(ci.rate).toBe(0.8);
    expect(ci.lower95).toBeGreaterThan(0.7);
    expect(ci.upper95).toBeLessThan(0.88);
  });

  it('labels all sensitivity scenarios as ASSUMPTION_ONLY_NOT_AUDITED', () => {
    const scenarios = buildSensitivityScenarios([
      {
        scenarioLabel: 'conservative_50pct_acceptance',
        assumedAcceptanceRate: 0.5,
        assumedInferenceCostPerRunMicroUsd: 12_000,
        assumedInfraCostPerRunMicroUsd: 2_000,
        assumedRevenuePerAcceptedMicroUsd: null,
      },
      {
        scenarioLabel: 'hypothetical_pricing_test',
        assumedAcceptanceRate: 0.8,
        assumedInferenceCostPerRunMicroUsd: 12_000,
        assumedInfraCostPerRunMicroUsd: 2_000,
        assumedRevenuePerAcceptedMicroUsd: 500_000,
      },
    ]);

    expect(scenarios[0].classification).toBe('ASSUMPTION_ONLY_NOT_AUDITED');
    expect(scenarios[0].assumedCostPerAcceptedMicroUsd).toBe(28_000);
    expect(scenarios[0].contributionStatus).toBe('NOT_ESTABLISHED');
    expect(scenarios[1].classification).toBe('ASSUMPTION_ONLY_NOT_AUDITED');
    expect(scenarios[1].assumedCostPerAcceptedMicroUsd).toBe(17_500);
    expect(scenarios[1].assumedContributionPerAcceptedMicroUsd).toBe(482_500);
    expect(scenarios[1].contributionStatus).toBe('HYPOTHETICAL_ONLY');
  });

  it('distinguishes mocked vs observed runs, rejects duplicate scores, and generates deterministic reports', async () => {
    const datasetRaw = readFileSync(resolve(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
    const rubricRaw = readFileSync(resolve(EVAL_DIR, 'rubric-v1.json'), 'utf8');
    const manifestRaw = readFileSync(resolve(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
    const { manifest, briefs } = verifyFrozenDataset(datasetRaw, manifestRaw);
    const { rubric } = verifyFrozenRubric(rubricRaw, manifest.rubricSha256);

    const config: ExperimentConfig = {
      configVersion: 'b4-exp-v1.0.0',
      datasetVersion: manifest.datasetVersion,
      datasetSha256: manifest.datasetSha256,
      rubricVersion: manifest.rubricVersion,
      rubricSha256: manifest.rubricSha256,
      mode: 'fixture_simulated',
      trialsPerBrief: 1,
      randomSeed: 'b4-report-seed',
      plannedModelId: 'anthropic/claude-sonnet-4',
      plannedModelVersion: '2025-05-14',
      temperature: 0.3,
      maxOutputTokensBudget: 1200,
      targetDurationSec: 30,
    };

    const subset = briefs.slice(0, 2);
    const fixtureTrials = await runPairedFixtureBenchmark(subset, config);
    const bundle = buildBlindEvaluationPackets(fixtureTrials, subset, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });

    const fixtureReport1 = buildBenchmarkReport({
      config,
      rubric,
      trials: fixtureTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: [],
    });
    const fixtureReport2 = buildBenchmarkReport({
      config,
      rubric,
      trials: fixtureTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: [],
    });

    expect(fixtureReport1.comparativeQualityStatus).toBe('QUALITY_NOT_MEASURED');
    expect(fixtureReport1.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(fixtureReport1.customerAcceptanceStatus).toBe('NOT_PROVEN');
    expect(fixtureReport1.provenanceSha256).toBe(fixtureReport2.provenanceSha256);
    expect(fixtureReport1.arms.arm_a_sophia_basic.totalRealPaidInferenceCostMicroUsd).toBe(0);
    expect(fixtureReport1.arms.arm_a_sophia_basic.costPerAcceptedDeliverable.status).toBe(
      'UNDEFINED_ZERO_ACCEPTED',
    );
    expect(fixtureReport1.arms.arm_a_sophia_basic.contributionPerAcceptedDeliverable.status).toBe(
      'NOT_ESTABLISHED',
    );

    const md = renderBenchmarkReportMarkdown(fixtureReport1);
    expect(md).toContain('QUALITY_NOT_MEASURED');
    expect(md).toContain(fixtureReport1.provenanceSha256);

    // Duplicate reviewer score rejection & unknown blind ID rejection
    const validScore = {
      reviewerId: 'rev-01',
      blindOutputId: bundle.armKeyMap[0].blindOutputId,
      rubricVersion: rubric.rubricVersion,
      scoringOrigin: 'human_independent',
      criterionScores: {
        hook_clarity: 4,
        logical_structure: 4,
        cta_relevance: 4,
        brand_and_audience_fit: 4,
        compliance_and_publishability: 4,
      },
      accepted: true,
      rejectionReason: null,
      estimatedEditingMinutes: 2,
      founderSupportMinutes: 1,
    };

    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: [validScore, validScore],
      }),
    ).toThrow(/Duplicate reviewer score/);

    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: [{ ...validScore, blindOutputId: 'blind-9999-unknown' }],
      }),
    ).toThrow(/unknown blindOutputId/);

    // Synthetic future live_observed record check (unit test of aggregation layer only)
    const liveTrials: TrialExecutionRecord[] = fixtureTrials.map((t) => ({
      ...t,
      executionMode: 'live_observed',
      qualityStatus: 'QUALITY_MEASURED',
      telemetry: {
        ...t.telemetry,
        promptTokens: { status: 'OBSERVED', value: 420 },
        completionTokens: { status: 'OBSERVED', value: 280 },
        wallClockLatencyMs: { status: 'OBSERVED', value: 1450 },
        estimatedInferenceCostMicroUsd: { status: 'OBSERVED', value: 11_000 },
        measuredInferenceCostMicroUsd: { status: 'OBSERVED', value: 10_500 },
        realPaidInferenceCostMicroUsd: 10_500,
      },
    }));

    const scoresForBothArms = bundle.armKeyMap.map((entry) => ({
      ...validScore,
      blindOutputId: entry.blindOutputId,
    }));

    const liveReport = buildBenchmarkReport({
      config: { ...config, mode: 'live_observed' },
      rubric,
      trials: liveTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scoresForBothArms,
    });

    expect(liveReport.comparativeQualityStatus).toBe('QUALITY_MEASURED');
    expect(liveReport.realInferenceCostStatus).toBe('OBSERVED');
    expect(liveReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 21_000,
    });
    expect(liveReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 10_500,
    });

    // Tampered armKeyMap (arm mismatch) must be rejected
    const tamperedKeyMap = bundle.armKeyMap.map((entry, idx) =>
      idx === 0
        ? {
            ...entry,
            armId:
              entry.armId === 'arm_a_sophia_basic'
                ? ('arm_b_direct_model' as const)
                : ('arm_a_sophia_basic' as const),
          }
        : entry,
    );
    expect(() =>
      buildBenchmarkReport({
        config: { ...config, mode: 'live_observed' },
        rubric,
        trials: liveTrials,
        armKeyMap: tamperedKeyMap,
        reviewerScores: scoresForBothArms,
      }),
    ).toThrow(/arm mismatch/);

    // Live trials with missing observed cost must NOT claim realInferenceCostStatus: OBSERVED
    const missingCostLiveTrials: TrialExecutionRecord[] = liveTrials.map((t) => ({
      ...t,
      telemetry: {
        ...t.telemetry,
        measuredInferenceCostMicroUsd: { status: 'NOT_MEASURED', reason: 'provider_usage_missing' },
      },
    }));
    const missingCostReport = buildBenchmarkReport({
      config: { ...config, mode: 'live_observed' },
      rubric,
      trials: missingCostLiveTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scoresForBothArms,
    });
    expect(missingCostReport.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(missingCostReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable.status).toBe('NOT_MEASURED');
  });
});
