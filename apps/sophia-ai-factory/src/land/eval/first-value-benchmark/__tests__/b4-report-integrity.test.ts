import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkReport,
  buildBlindEvaluationPackets,
  computeSha256Hex,
  installBenchmarkZeroNetworkGuard,
  renderBenchmarkReportMarkdown,
  runPairedFixtureBenchmark,
  verifyFrozenDataset,
  verifyFrozenRubric,
  type BlindAssignmentKeyEntry,
  type ExperimentConfig,
  type MetricMeasurement,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = resolve(process.cwd(), 'eval/b4-first-value');

function loadFrozenFixtureContext(trialsPerBrief = 3, briefCount = 1) {
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
    trialsPerBrief,
    randomSeed: 'b4-integrity-seed',
    plannedModelId: 'anthropic/claude-sonnet-4',
    plannedModelVersion: '2025-05-14',
    temperature: 0.3,
    maxOutputTokensBudget: 1200,
    targetDurationSec: 30,
  };

  return { manifest, rubric, briefs: briefs.slice(0, briefCount), allBriefs: briefs, config };
}

function toLiveObservedTrial(
  trial: TrialExecutionRecord,
  overrides?: {
    measuredCost?: MetricMeasurement<number>;
    estimatedCost?: MetricMeasurement<number>;
    promptTokens?: MetricMeasurement<number>;
    completionTokens?: MetricMeasurement<number>;
    latencyMs?: MetricMeasurement<number>;
    realPaidMicroUsd?: number;
    infraMicroUsd?: number;
    modelId?: string;
    modelVersion?: string;
  },
): TrialExecutionRecord {
  return {
    ...trial,
    executionMode: 'live_observed',
    qualityStatus: 'QUALITY_MEASURED',
    telemetry: {
      ...trial.telemetry,
      modelId: overrides?.modelId ?? trial.telemetry.modelId,
      modelVersion: overrides?.modelVersion ?? trial.telemetry.modelVersion,
      promptTokens: overrides?.promptTokens ?? { status: 'OBSERVED', value: 400 },
      completionTokens: overrides?.completionTokens ?? { status: 'OBSERVED', value: 250 },
      wallClockLatencyMs: overrides?.latencyMs ?? { status: 'OBSERVED', value: 1200 },
      estimatedInferenceCostMicroUsd: overrides?.estimatedCost ?? { status: 'OBSERVED', value: 11_000 },
      measuredInferenceCostMicroUsd: overrides?.measuredCost ?? { status: 'OBSERVED', value: 10_000 },
      infrastructureCostAllocationMicroUsd: overrides?.infraMicroUsd ?? 0,
      realPaidInferenceCostMicroUsd: overrides?.realPaidMicroUsd ?? 10_000,
    },
  };
}

function makeHumanScore(blindOutputId: string, rubricVersion: string, accepted = true, reviewerId = 'rev-01') {
  return {
    reviewerId,
    blindOutputId,
    rubricVersion,
    scoringOrigin: 'human_independent' as const,
    criterionScores: {
      hook_clarity: accepted ? 4 : 2,
      logical_structure: accepted ? 4 : 2,
      cta_relevance: accepted ? 4 : 2,
      brand_and_audience_fit: accepted ? 4 : 2,
      compliance_and_publishability: accepted ? 4 : 2,
    },
    accepted,
    rejectionReason: accepted ? null : 'below_threshold',
    estimatedEditingMinutes: accepted ? 2 : 8,
    founderSupportMinutes: 1,
  };
}

describe('B4 Cost Aggregation Integrity (All-Trials Observed Invariant)', () => {
  it('marks total cost OBSERVED only when 3/3 trials have observed cost and rejects partial 2/3, 1/3, and 0/3', async () => {
    const { rubric, briefs, config } = loadFrozenFixtureContext(3, 1);
    const fixtureTrials = await runPairedFixtureBenchmark(briefs, config);
    const bundle = buildBlindEvaluationPackets(fixtureTrials, briefs, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });
    const scores = bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true));
    const liveConfig: ExperimentConfig = { ...config, mode: 'live_observed' };

    // 1. 3/3 observed cost values
    const allObserved = fixtureTrials.map((t) => toLiveObservedTrial(t));
    const reportAll = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: allObserved,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(reportAll.realInferenceCostStatus).toBe('OBSERVED');
    expect(reportAll.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 30_000,
    });
    expect(reportAll.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 10_000,
    });

    // 2. 2/3 observed cost values on Arm A -> NOT_MEASURED (partial)
    let armAMissed = 0;
    const twoOfThree = fixtureTrials.map((t) => {
      if (t.armId === 'arm_a_sophia_basic' && armAMissed < 1) {
        armAMissed += 1;
        return toLiveObservedTrial(t, {
          measuredCost: { status: 'NOT_MEASURED', reason: 'provider_usage_missing' },
        });
      }
      return toLiveObservedTrial(t);
    });
    const report2of3 = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: twoOfThree,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(report2of3.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(report2of3.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'NOT_MEASURED',
      reason: 'partial_observed_measurements:2/3',
    });
    expect(report2of3.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'NOT_MEASURED',
      microUsd: null,
      reason: 'partial_observed_measurements:2/3',
    });

    // 3. 1/3 observed cost values on Arm A -> NOT_MEASURED (partial)
    let armAKept = 0;
    const oneOfThree = fixtureTrials.map((t) => {
      if (t.armId === 'arm_a_sophia_basic') {
        armAKept += 1;
        if (armAKept > 1) {
          return toLiveObservedTrial(t, {
            measuredCost: { status: 'NOT_MEASURED', reason: 'provider_usage_missing' },
          });
        }
      }
      return toLiveObservedTrial(t);
    });
    const report1of3 = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: oneOfThree,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(report1of3.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(report1of3.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'NOT_MEASURED',
      reason: 'partial_observed_measurements:1/3',
    });

    // 4. 0/3 observed cost values on Arm A -> NOT_MEASURED (no observed)
    const zeroOfThree = fixtureTrials.map((t) =>
      t.armId === 'arm_a_sophia_basic'
        ? toLiveObservedTrial(t, { measuredCost: { status: 'NOT_MEASURED', reason: 'provider_usage_missing' } })
        : toLiveObservedTrial(t),
    );
    const report0of3 = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: zeroOfThree,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(report0of3.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(report0of3.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'NOT_MEASURED',
      reason: 'no_observed_measurements',
    });
  });

  it('prevents mixed observed/estimated promotion, separates zero observed vs unknown cost, and rejects negative/overflow values', async () => {
    const { rubric, briefs, config } = loadFrozenFixtureContext(3, 1);
    const fixtureTrials = await runPairedFixtureBenchmark(briefs, config);
    const bundle = buildBlindEvaluationPackets(fixtureTrials, briefs, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });
    const scores = bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true));
    const liveConfig: ExperimentConfig = { ...config, mode: 'live_observed' };

    // 5. Mixed observed and estimated (estimated present, measured missing on one trial) never becomes OBSERVED
    const mixedEstimated = fixtureTrials.map((t, idx) =>
      idx === 0
        ? toLiveObservedTrial(t, {
            estimatedCost: { status: 'OBSERVED', value: 12_000 },
            measuredCost: { status: 'NOT_MEASURED', reason: 'estimated_only_not_billed' },
          })
        : toLiveObservedTrial(t),
    );
    const mixedReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: mixedEstimated,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(mixedReport.arms.arm_a_sophia_basic.totalEstimatedInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 34_000,
    });
    expect(mixedReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd.status).toBe('NOT_MEASURED');
    expect(mixedReport.realInferenceCostStatus).toBe('NOT_MEASURED');

    // 6. Observed zero cost ($0.000000) vs unknown cost
    const zeroObservedTrials = fixtureTrials.map((t) =>
      toLiveObservedTrial(t, { measuredCost: { status: 'OBSERVED', value: 0 }, realPaidMicroUsd: 0 }),
    );
    const zeroObservedReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: zeroObservedTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(zeroObservedReport.realInferenceCostStatus).toBe('OBSERVED');
    expect(zeroObservedReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 0,
    });
    expect(zeroObservedReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 0,
    });

    // 7. Invalid negative cost rejected
    const negativeCostTrials = fixtureTrials.map((t, idx) =>
      idx === 0 ? toLiveObservedTrial(t, { measuredCost: { status: 'OBSERVED', value: -500 } }) : toLiveObservedTrial(t),
    );
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric,
        trials: negativeCostTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/cannot be negative/);

    // 8. Zero accepted deliverables keeps costPerAccepted UNDEFINED_ZERO_ACCEPTED
    const allRejectedScores = bundle.armKeyMap.map((entry) =>
      makeHumanScore(entry.blindOutputId, rubric.rubricVersion, false),
    );
    const zeroAcceptedReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: fixtureTrials.map((t) => toLiveObservedTrial(t)),
      armKeyMap: bundle.armKeyMap,
      reviewerScores: allRejectedScores,
    });
    expect(zeroAcceptedReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'UNDEFINED_ZERO_ACCEPTED',
      microUsd: null,
      reason: 'zero_accepted_deliverables_division_prevented',
    });
    expect(zeroAcceptedReport.arms.arm_a_sophia_basic.contributionPerAcceptedDeliverable.status).toBe(
      'NOT_ESTABLISHED',
    );

    // 9. Very large integer microUSD values: safe within MAX_SAFE_INTEGER and rejected on overflow
    const safeLarge = Math.floor(Number.MAX_SAFE_INTEGER / 4);
    const safeLargeTrials = fixtureTrials.map((t) =>
      toLiveObservedTrial(t, { measuredCost: { status: 'OBSERVED', value: safeLarge }, realPaidMicroUsd: safeLarge }),
    );
    const safeLargeReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: safeLargeTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(safeLargeReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: safeLarge * 3,
    });

    const overflowValue = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    const overflowTrials = fixtureTrials.map((t) =>
      toLiveObservedTrial(t, {
        measuredCost: { status: 'OBSERVED', value: overflowValue },
        realPaidMicroUsd: 0,
      }),
    );
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric,
        trials: overflowTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/overflowed Number.MAX_SAFE_INTEGER/);

    // 10. Cost aggregation after a rejected trial still includes all trials in numerator and divides by accepted count only
    const partialAcceptScores = bundle.armKeyMap.map((entry) =>
      makeHumanScore(entry.blindOutputId, rubric.rubricVersion, entry.trialNumber !== 3),
    );
    const rejectedTrialCostReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: fixtureTrials.map((t) => toLiveObservedTrial(t)),
      armKeyMap: bundle.armKeyMap,
      reviewerScores: partialAcceptScores,
    });
    expect(rejectedTrialCostReport.arms.arm_a_sophia_basic.acceptedHumanCount).toBe(2);
    expect(rejectedTrialCostReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 30_000,
    });
    expect(rejectedTrialCostReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 15_000,
    });

    // 11. Multi-reviewer scoring counts unique deliverables (never inflates denominator) and partial latency stays NOT_MEASURED
    const dualReviewerScores = [
      ...bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true, 'rev-01')),
      ...bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true, 'rev-02')),
    ];
    const partialLatencyTrials = fixtureTrials.map((t, idx) =>
      idx === 0
        ? toLiveObservedTrial(t, { latencyMs: { status: 'NOT_MEASURED', reason: 'timer_missing' } })
        : toLiveObservedTrial(t),
    );
    const dualReviewerReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: partialLatencyTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: dualReviewerScores,
    });
    expect(dualReviewerReport.arms.arm_a_sophia_basic.scoredTrialsHuman).toBe(3);
    expect(dualReviewerReport.arms.arm_a_sophia_basic.acceptedHumanCount).toBe(3);
    expect(dualReviewerReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 10_000,
    });
    expect(dualReviewerReport.arms.arm_a_sophia_basic.latencyP50Ms).toEqual({
      status: 'NOT_MEASURED',
      reason: 'partial_observed_measurements:2/3',
    });
    expect(dualReviewerReport.arms.arm_a_sophia_basic.latencyP95Ms).toEqual({
      status: 'NOT_MEASURED',
      reason: 'partial_observed_measurements:2/3',
    });
  });
});

describe('B4 Trial Output/Brief Provenance Integrity', () => {
  it('binds every score to exact trialId, briefId, armId, outputSha256, and blind packet while allowing identical text across distinct trials', async () => {
    const { rubric, briefs, config } = loadFrozenFixtureContext(2, 2);
    const fixtureTrials = await runPairedFixtureBenchmark(briefs, config);
    const bundle = buildBlindEvaluationPackets(fixtureTrials, briefs, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });
    const scores = bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true));

    // Correct score mapping with reviewerPacket integrity check
    const validReport = buildBenchmarkReport({
      config,
      rubric,
      trials: fixtureTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerPacket: bundle.reviewerPacket,
      reviewerScores: scores,
    });
    expect(validReport.arms.arm_a_sophia_basic.scoredTrialsHuman).toBe(4);
    expect(validReport.arms.arm_b_direct_model.scoredTrialsHuman).toBe(4);

    // Wrong briefId in armKeyMap
    const wrongBriefMap: BlindAssignmentKeyEntry[] = bundle.armKeyMap.map((entry, idx) =>
      idx === 0 ? { ...entry, briefId: 'brief-wrong-999' } : entry,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric, trials: fixtureTrials, armKeyMap: wrongBriefMap, reviewerScores: scores }),
    ).toThrow(/briefId mismatch/);

    // Wrong outputSha256 in armKeyMap
    const wrongDigestMap: BlindAssignmentKeyEntry[] = bundle.armKeyMap.map((entry, idx) =>
      idx === 0 ? { ...entry, outputSha256: '0'.repeat(64) } : entry,
    );
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: wrongDigestMap,
        reviewerScores: scores,
      }),
    ).toThrow(/outputSha256 mismatch/);

    // Wrong armId in armKeyMap
    const wrongArmMap: BlindAssignmentKeyEntry[] = bundle.armKeyMap.map((entry, idx) =>
      idx === 0
        ? {
            ...entry,
            armId: entry.armId === 'arm_a_sophia_basic' ? 'arm_b_direct_model' : 'arm_a_sophia_basic',
          }
        : entry,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric, trials: fixtureTrials, armKeyMap: wrongArmMap, reviewerScores: scores }),
    ).toThrow(/arm mismatch/);

    // Unknown trialId in armKeyMap
    const unknownTrialMap: BlindAssignmentKeyEntry[] = bundle.armKeyMap.map((entry, idx) =>
      idx === 0 ? { ...entry, trialId: 'unknown-trial-id' } : entry,
    );
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: unknownTrialMap,
        reviewerScores: scores,
      }),
    ).toThrow(/unknown trialId/);

    // Duplicate trialId in trials array
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: [...fixtureTrials, fixtureTrials[0]],
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Duplicate trialId/);

    // Duplicate trialId in armKeyMap
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: [...bundle.armKeyMap, { ...bundle.armKeyMap[0], blindOutputId: 'blind-dup-trial' }],
        reviewerScores: scores,
      }),
    ).toThrow(/Duplicate trialId/);

    // Repeated scoring of the same trial by the same reviewer
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: [scores[0], scores[0]],
      }),
    ).toThrow(/Duplicate reviewer score/);

    // Tampered blind packet (script altered after key generation)
    const tamperedPacket = bundle.reviewerPacket.map((item, idx) =>
      idx === 0 ? { ...item, renderedScript: 'Tampered script body' } : item,
    );
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerPacket: tamperedPacket,
        reviewerScores: scores,
      }),
    ).toThrow(/Tampered blind packet: renderedScript mismatch/);

    // Cross-arm score substitution (swapping blindOutputId between an Arm A and Arm B entry in armKeyMap)
    const armAEntry = bundle.armKeyMap.find((e) => e.armId === 'arm_a_sophia_basic');
    const armBEntry = bundle.armKeyMap.find((e) => e.armId === 'arm_b_direct_model' && e.briefId === armAEntry?.briefId);
    expect(armAEntry).toBeDefined();
    expect(armBEntry).toBeDefined();
    const crossArmSwappedMap = bundle.armKeyMap.map((entry) => {
      if (entry.trialId === armAEntry?.trialId && armBEntry) {
        return { ...entry, blindOutputId: armBEntry.blindOutputId };
      }
      if (entry.trialId === armBEntry?.trialId && armAEntry) {
        return { ...entry, blindOutputId: armAEntry.blindOutputId };
      }
      return entry;
    });
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fixtureTrials,
        armKeyMap: crossArmSwappedMap,
        reviewerPacket: bundle.reviewerPacket,
        reviewerScores: scores,
      }),
    ).toThrow(/Tampered blind packet: renderedScript mismatch/);

    // Valid independently generated outputs with identical text content across distinct trialIds
    const sharedText = 'Title: Identical Deterministic Script\nTarget Duration: 30s\nScene 1 (30s) | Visual: Shop | Narration: Visit today.';
    const sharedDigest = computeSha256Hex(sharedText);
    const identicalOutputTrials = fixtureTrials.map((t) => ({
      ...t,
      renderedOutput: sharedText,
      outputSha256: sharedDigest,
    }));
    const identicalBundle = buildBlindEvaluationPackets(identicalOutputTrials, briefs, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });
    const identicalScores = identicalBundle.armKeyMap.map((entry) =>
      makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true),
    );
    const identicalReport = buildBenchmarkReport({
      config,
      rubric,
      trials: identicalOutputTrials,
      armKeyMap: identicalBundle.armKeyMap,
      reviewerPacket: identicalBundle.reviewerPacket,
      reviewerScores: identicalScores,
    });
    expect(identicalReport.arms.arm_a_sophia_basic.totalTrials).toBe(4);
    expect(identicalReport.arms.arm_b_direct_model.totalTrials).toBe(4);
  });
});

describe('B4 Execution Mode & Telemetry Consistency', () => {
  it('enforces strict alignment between config.mode, trial.executionMode, provider metadata, and zero-network containment', async () => {
    const { rubric, briefs, config } = loadFrozenFixtureContext(1, 1);
    const fixtureTrials = await runPairedFixtureBenchmark(briefs, config);
    const bundle = buildBlindEvaluationPackets(fixtureTrials, briefs, {
      seed: config.randomSeed,
      rubricVersion: config.rubricVersion,
    });
    const scores = bundle.armKeyMap.map((entry) => makeHumanScore(entry.blindOutputId, rubric.rubricVersion, true));
    const liveConfig: ExperimentConfig = { ...config, mode: 'live_observed' };

    // 1. All-mock configuration produces honest NOT_MEASURED report
    const allMockReport = buildBenchmarkReport({
      config,
      rubric,
      trials: fixtureTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerPacket: bundle.reviewerPacket,
      reviewerScores: scores,
    });
    expect(allMockReport.comparativeQualityStatus).toBe('QUALITY_NOT_MEASURED');
    expect(allMockReport.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(allMockReport.customerAcceptanceStatus).toBe('NOT_PROVEN');
    const md = renderBenchmarkReportMarkdown(allMockReport);
    expect(md).toContain('QUALITY_NOT_MEASURED');
    expect(md).not.toMatch(/outperforms|superior|better than direct/i);

    // 2. Mock trial under live_observed config -> rejected
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric,
        trials: fixtureTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Execution mode mismatch/);

    // 3. Observed trial under mock config -> rejected
    const liveTrials = fixtureTrials.map((t) => toLiveObservedTrial(t));
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: liveTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Execution mode mismatch/);

    // 4. Mixed trial modes (1 mock + 1 live) -> rejected under both configs
    const mixedModeTrials = [fixtureTrials[0], liveTrials[1]];
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric,
        trials: mixedModeTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Execution mode mismatch/);
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: mixedModeTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Execution mode mismatch/);

    // 5. Missing provider metadata on live_observed trial -> rejected
    const missingProviderTrials = fixtureTrials.map((t, idx) =>
      idx === 0 ? toLiveObservedTrial(t, { modelId: '   ' }) : toLiveObservedTrial(t),
    );
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric,
        trials: missingProviderTrials,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/Missing provider metadata/);

    // 6. Missing token usage on live_observed trial -> realInferenceCostStatus stays NOT_MEASURED
    const missingTokensTrials = fixtureTrials.map((t, idx) =>
      idx === 0
        ? toLiveObservedTrial(t, { promptTokens: { status: 'NOT_MEASURED', reason: 'provider_omitted_usage' } })
        : toLiveObservedTrial(t),
    );
    const missingTokensReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: missingTokensTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(missingTokensReport.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(missingTokensReport.arms.arm_a_sophia_basic.totalPromptTokens.status).toBe('NOT_MEASURED');

    // 7. Missing cost telemetry on live_observed trial -> NOT_MEASURED
    const missingCostTrials = fixtureTrials.map((t) =>
      toLiveObservedTrial(t, { measuredCost: { status: 'NOT_MEASURED', reason: 'invoice_pending' } }),
    );
    const missingCostReport = buildBenchmarkReport({
      config: liveConfig,
      rubric,
      trials: missingCostTrials,
      armKeyMap: bundle.armKeyMap,
      reviewerScores: scores,
    });
    expect(missingCostReport.realInferenceCostStatus).toBe('NOT_MEASURED');
    expect(missingCostReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable.status).toBe('NOT_MEASURED');

    // 8. Inconsistent execution provenance (fixture trial claiming OBSERVED tokens or tampered outputSha256) -> rejected
    const fabricatedFixtureTokens: TrialExecutionRecord[] = fixtureTrials.map((t, idx) =>
      idx === 0
        ? { ...t, telemetry: { ...t.telemetry, promptTokens: { status: 'OBSERVED', value: 123 } } }
        : t,
    );
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: fabricatedFixtureTokens,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/fixture_simulated trials cannot report OBSERVED provider telemetry/);

    const forgedOutputDigest: TrialExecutionRecord[] = fixtureTrials.map((t, idx) =>
      idx === 0 ? { ...t, outputSha256: 'f'.repeat(64) } : t,
    );
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: forgedOutputDigest,
        armKeyMap: bundle.armKeyMap,
        reviewerScores: scores,
      }),
    ).toThrow(/outputSha256 does not match renderedOutput/);

    // 9. Attempted live execution blocked by runner and zero-network guard
    const guard = installBenchmarkZeroNetworkGuard();
    try {
      await expect(runPairedFixtureBenchmark(briefs, liveConfig)).rejects.toThrow(/ZERO_PAID_INFERENCE/);
      await expect(fetch('https://api.openai.com/v1/chat/completions')).rejects.toThrow(/B4_ZERO_NETWORK_VIOLATION/);
      expect(guard.blockedUrls).toEqual(['https://api.openai.com/v1/chat/completions']);
    } finally {
      guard.restore();
    }
  });

  it('replays full 50x2x3=300 fixture benchmark deterministically with identical hashes and zero superiority claims', async () => {
    const { rubric, allBriefs, config } = loadFrozenFixtureContext(3, 50);
    expect(allBriefs).toHaveLength(50);

    const guard = installBenchmarkZeroNetworkGuard();
    try {
      const run1 = await runPairedFixtureBenchmark(allBriefs, config);
      const run2 = await runPairedFixtureBenchmark(allBriefs, config);

      expect(guard.blockedUrls).toHaveLength(0);
      expect(run1).toHaveLength(300);
      expect(run2).toHaveLength(300);
      expect(run1.map((t) => `${t.trialId}:${t.outputSha256}`)).toEqual(
        run2.map((t) => `${t.trialId}:${t.outputSha256}`),
      );

      const bundle1 = buildBlindEvaluationPackets(run1, allBriefs, {
        seed: config.randomSeed,
        rubricVersion: config.rubricVersion,
      });
      const bundle2 = buildBlindEvaluationPackets(run2, allBriefs, {
        seed: config.randomSeed,
        rubricVersion: config.rubricVersion,
      });
      expect(bundle1.reviewerPacketSha256).toBe(bundle2.reviewerPacketSha256);
      expect(bundle1.armKeyMapSha256).toBe(bundle2.armKeyMapSha256);

      const report1 = buildBenchmarkReport({
        config,
        rubric,
        trials: run1,
        armKeyMap: bundle1.armKeyMap,
        reviewerPacket: bundle1.reviewerPacket,
        reviewerScores: [],
      });
      const report2 = buildBenchmarkReport({
        config,
        rubric,
        trials: run2,
        armKeyMap: bundle2.armKeyMap,
        reviewerPacket: bundle2.reviewerPacket,
        reviewerScores: [],
      });

      expect(report1.provenanceSha256).toBe(report2.provenanceSha256);
      expect(report1.comparativeQualityStatus).toBe('QUALITY_NOT_MEASURED');
      expect(report1.realInferenceCostStatus).toBe('NOT_MEASURED');
      expect(report1.customerAcceptanceStatus).toBe('NOT_PROVEN');
      expect(report1.arms.arm_a_sophia_basic.totalTrials).toBe(150);
      expect(report1.arms.arm_b_direct_model.totalTrials).toBe(150);
      expect(report1.arms.arm_a_sophia_basic.totalRealPaidInferenceCostMicroUsd).toBe(0);
      expect(report1.arms.arm_b_direct_model.totalRealPaidInferenceCostMicroUsd).toBe(0);
      expect(report1.arms.arm_a_sophia_basic.costPerAcceptedDeliverable.status).toBe('UNDEFINED_ZERO_ACCEPTED');

      const md = renderBenchmarkReportMarkdown(report1);
      expect(md).not.toMatch(/outperforms|superior|wins|better than direct/i);
    } finally {
      guard.restore();
    }
  });
});
