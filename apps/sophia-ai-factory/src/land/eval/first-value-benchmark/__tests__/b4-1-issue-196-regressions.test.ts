import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkReport,
  buildBlindEvaluationPackets,
  computeSha256Hex,
  runPairedFixtureBenchmark,
  verifyFrozenDataset,
  verifyFrozenRubric,
  type BlindAssignmentKeyEntry,
  type ExperimentConfig,
  type MetricMeasurement,
  type ReviewerScoreRecord,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');

function loadBundle() {
  const datasetRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
  const manifestRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
  const rubricRaw = fs.readFileSync(path.join(EVAL_DIR, 'rubric-v1.json'), 'utf8');
  const dataset = verifyFrozenDataset(datasetRaw, manifestRaw);
  const rubric = verifyFrozenRubric(rubricRaw, dataset.manifest.rubricSha256).rubric;
  return { ...dataset, rubric };
}

function makeConfig(
  mode: 'fixture_simulated' | 'live_observed',
  datasetSha256: string,
  rubricVersion: string,
  rubricSha256: string,
): ExperimentConfig {
  return {
    configVersion: 'b4-config-v1.0.0',
    mode,
    datasetVersion: 'b4-dataset-v1.0.0',
    datasetSha256,
    rubricVersion,
    rubricSha256,
    randomSeed: 'seed-196',
    trialsPerBrief: 1,
    targetDurationSec: 30,
    plannedModelId: 'gpt-5.4-mini-2026-03-17',
    plannedModelVersion: 'gpt-5.4-mini-2026-03-17',
    maxOutputTokensBudget: 1200,
    temperature: 0.3,
  };
}

function makeLiveTrial(
  briefId: string,
  industry: TrialExecutionRecord['industry'],
  armId: 'arm_a_sophia_basic' | 'arm_b_direct_model',
  trialNumber: number,
  renderedOutput: string,
  overrides?: Partial<TrialExecutionRecord['telemetry']>,
): TrialExecutionRecord {
  const trialId = `${briefId}:${armId}:t${trialNumber}`;
  return {
    trialId,
    briefId,
    industry,
    armId,
    trialNumber,
    executionMode: 'live_observed',
    qualityStatus: 'QUALITY_NOT_MEASURED',
    inputSha256: computeSha256Hex(`input:${briefId}:${armId}:${trialNumber}`),
    outputSha256: computeSha256Hex(renderedOutput),
    renderedOutput,
    orchestrationNotes: 'live test fixture',
    telemetry: {
      modelId: 'gpt-5.4-mini-2026-03-17',
      modelVersion: 'gpt-5.4-mini-2026-03-17',
      retryCount: 0,
      wallClockLatencyMs: { status: 'OBSERVED', value: 1200 },
      promptTokens: { status: 'OBSERVED', value: 500 },
      completionTokens: { status: 'OBSERVED', value: 300 },
      estimatedInferenceCostMicroUsd: { status: 'OBSERVED', value: 1725 },
      measuredInferenceCostMicroUsd: { status: 'OBSERVED', value: 1725 },
      realPaidInferenceCostMicroUsd: 1725,
      infrastructureCostAllocationMicroUsd: 100,
      ...overrides,
    },
  };
}

function makeScore(
  reviewerId: string,
  blindOutputId: string,
  rubricVersion: string,
  accepted: boolean,
): ReviewerScoreRecord {
  const val = accepted ? 5 : 2;
  return {
    reviewerId,
    blindOutputId,
    rubricVersion,
    scoringOrigin: 'human_independent',
    criterionScores: {
      hook_clarity: val,
      logical_structure: val,
      cta_relevance: val,
      brand_and_audience_fit: val,
      compliance_and_publishability: val,
    },
    accepted,
    rejectionReason: accepted ? null : 'Needs full rewrite.',
    estimatedEditingMinutes: accepted ? 3 : 20,
    founderSupportMinutes: 0,
  };
}

describe('B4 report integrity regressions: multi-reviewer consensus, cost provenance, and trial mapping', () => {
  it('enforces unanimous multi-reviewer acceptance across accept, reject, split, duplicate, missing, conflicting, and same-output distinct-trial cases', () => {
    const bundle = loadBundle();
    const b1 = bundle.briefs[0];
    const b2 = bundle.briefs[1];
    const config = makeConfig(
      'live_observed',
      bundle.manifest.datasetSha256,
      bundle.rubric.rubricVersion,
      bundle.manifest.rubricSha256,
    );

    const sharedText = 'Identical script body across two distinct trials.';
    const trials: TrialExecutionRecord[] = [
      makeLiveTrial(b1.briefId, b1.industry, 'arm_a_sophia_basic', 1, sharedText),
      makeLiveTrial(b1.briefId, b1.industry, 'arm_b_direct_model', 1, 'Arm B output 1'),
      makeLiveTrial(b2.briefId, b2.industry, 'arm_a_sophia_basic', 1, sharedText),
      makeLiveTrial(b2.briefId, b2.industry, 'arm_b_direct_model', 1, 'Arm B output 2'),
    ];
    const { reviewerPacket, armKeyMap } = buildBlindEvaluationPackets(trials, [b1, b2], {
      rubricVersion: bundle.rubric.rubricVersion,
      seed: 'seed-consensus',
    });
    const blindFor = (trialId: string) =>
      armKeyMap.find((k) => k.trialId === trialId)?.blindOutputId ?? '';

    const a1 = blindFor(`${b1.briefId}:arm_a_sophia_basic:t1`);
    const a2 = blindFor(`${b2.briefId}:arm_a_sophia_basic:t1`);
    const b1Out = blindFor(`${b1.briefId}:arm_b_direct_model:t1`);
    const b2Out = blindFor(`${b2.briefId}:arm_b_direct_model:t1`);

    // a1: both accept (1 accepted); a2: split (rev-1 accept, rev-2 reject -> 0 accepted)
    // b1Out: both reject (0 accepted); b2Out: both accept (1 accepted)
    const scores: ReviewerScoreRecord[] = [
      makeScore('rev-1', a1, bundle.rubric.rubricVersion, true),
      makeScore('rev-2', a1, bundle.rubric.rubricVersion, true),
      makeScore('rev-1', a2, bundle.rubric.rubricVersion, true),
      makeScore('rev-2', a2, bundle.rubric.rubricVersion, false),
      makeScore('rev-1', b1Out, bundle.rubric.rubricVersion, false),
      makeScore('rev-2', b1Out, bundle.rubric.rubricVersion, false),
      makeScore('rev-1', b2Out, bundle.rubric.rubricVersion, true),
      makeScore('rev-2', b2Out, bundle.rubric.rubricVersion, true),
    ];

    const report = buildBenchmarkReport({
      config,
      rubric: bundle.rubric,
      trials,
      armKeyMap,
      reviewerPacket,
      reviewerScores: scores,
      requiredReviewerIds: ['rev-1', 'rev-2'],
    });

    // Same rendered output across distinct trial IDs counts as 2 distinct deliverables, not 1 or 4
    expect(report.arms.arm_a_sophia_basic.scoredTrialsHuman).toBe(2);
    expect(report.arms.arm_a_sophia_basic.acceptedHumanCount).toBe(1);
    expect(report.arms.arm_b_direct_model.scoredTrialsHuman).toBe(2);
    expect(report.arms.arm_b_direct_model.acceptedHumanCount).toBe(1);
    // Total variable cost for arm A = 2 * (1725 + 100) = 3650 over 1 accepted deliverable
    expect(report.arms.arm_a_sophia_basic.costPerAcceptedDeliverable).toEqual({
      status: 'COMPUTED',
      microUsd: 3650,
    });

    // Split decision alone yields 0 accepted and zero_accepted_deliverables cost status
    const splitOnlyReport = buildBenchmarkReport({
      config,
      rubric: bundle.rubric,
      trials: trials.slice(0, 2),
      armKeyMap: armKeyMap.filter((k) => k.briefId === b1.briefId),
      reviewerScores: [
        makeScore('rev-1', a1, bundle.rubric.rubricVersion, true),
        makeScore('rev-2', a1, bundle.rubric.rubricVersion, false),
        makeScore('rev-1', b1Out, bundle.rubric.rubricVersion, false),
        makeScore('rev-2', b1Out, bundle.rubric.rubricVersion, false),
      ],
      requiredReviewerIds: ['rev-1', 'rev-2'],
    });
    expect(splitOnlyReport.arms.arm_a_sophia_basic.scoredTrialsHuman).toBe(1);
    expect(splitOnlyReport.arms.arm_a_sophia_basic.acceptedHumanCount).toBe(0);
    expect(splitOnlyReport.arms.arm_a_sophia_basic.costPerAcceptedDeliverable.status).toBe(
      'UNDEFINED_ZERO_ACCEPTED',
    );

    // Unscored deliverable is also rejected when requiredReviewerIds is specified
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric: bundle.rubric,
        trials: trials.slice(0, 2),
        armKeyMap: armKeyMap.filter((k) => k.briefId === b1.briefId),
        reviewerScores: [
          makeScore('rev-1', a1, bundle.rubric.rubricVersion, true),
          makeScore('rev-2', a1, bundle.rubric.rubricVersion, false),
        ],
        requiredReviewerIds: ['rev-1', 'rev-2'],
      }),
    ).toThrow(/Missing required reviewer/);

    // Duplicate reviewer score rejected
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric: bundle.rubric,
        trials,
        armKeyMap,
        reviewerScores: [...scores, makeScore('rev-1', a1, bundle.rubric.rubricVersion, true)],
      }),
    ).toThrow(/Duplicate reviewer score/);

    // Conflicting score submission by same reviewer rejected
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric: bundle.rubric,
        trials,
        armKeyMap,
        reviewerScores: [...scores, makeScore('rev-1', a1, bundle.rubric.rubricVersion, false)],
      }),
    ).toThrow(/Duplicate reviewer score/);

    // Missing required reviewer rejected
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric: bundle.rubric,
        trials,
        armKeyMap,
        reviewerScores: scores.filter((s) => !(s.reviewerId === 'rev-2' && s.blindOutputId === a2)),
        requiredReviewerIds: ['rev-1', 'rev-2'],
      }),
    ).toThrow(/Missing required reviewer "rev-2"/);
  });

  it('rejects OBSERVED estimatedInferenceCostMicroUsd on fixture_simulated trials and classifies measured/estimated/missing/partial costs accurately', async () => {
    const bundle = loadBundle();
    const brief = bundle.briefs[0];
    const fixtureConfig = makeConfig(
      'fixture_simulated',
      bundle.manifest.datasetSha256,
      bundle.rubric.rubricVersion,
      bundle.manifest.rubricSha256,
    );
    const fixtureTrials = await runPairedFixtureBenchmark([brief], fixtureConfig);
    const armAFixture = fixtureTrials.find((t) => t.armId === 'arm_a_sophia_basic') as TrialExecutionRecord;
    const armBFixture = fixtureTrials.find((t) => t.armId === 'arm_b_direct_model') as TrialExecutionRecord;

    const tamperedFixture: TrialExecutionRecord = {
      ...armAFixture,
      telemetry: {
        ...armAFixture.telemetry,
        estimatedInferenceCostMicroUsd: { status: 'OBSERVED', value: 1500 },
      },
    };
    const { armKeyMap: fixtureKeyMap } = buildBlindEvaluationPackets([tamperedFixture, armBFixture], [brief], {
      rubricVersion: bundle.rubric.rubricVersion,
      seed: 'seed-f2',
    });

    expect(() =>
      buildBenchmarkReport({
        config: fixtureConfig,
        rubric: bundle.rubric,
        trials: [tamperedFixture, armBFixture],
        armKeyMap: fixtureKeyMap,
        reviewerScores: [],
      }),
    ).toThrow(/cannot report OBSERVED provider telemetry/);

    // Mode mismatch rejected
    const liveConfig = makeConfig(
      'live_observed',
      bundle.manifest.datasetSha256,
      bundle.rubric.rubricVersion,
      bundle.manifest.rubricSha256,
    );
    expect(() =>
      buildBenchmarkReport({
        config: liveConfig,
        rubric: bundle.rubric,
        trials: [armAFixture, armBFixture],
        armKeyMap: fixtureKeyMap,
        reviewerScores: [],
      }),
    ).toThrow(/Execution mode mismatch/);

    // Partial measured cost on live trials returns NOT_MEASURED at arm and report level
    const missingCost: MetricMeasurement<number> = { status: 'NOT_MEASURED', reason: 'provider_did_not_return_cost' };
    const b2 = bundle.briefs[1];
    const partialLiveTrials: TrialExecutionRecord[] = [
      makeLiveTrial(brief.briefId, brief.industry, 'arm_a_sophia_basic', 1, 'A1'),
      makeLiveTrial(brief.briefId, brief.industry, 'arm_b_direct_model', 1, 'B1'),
      makeLiveTrial(b2.briefId, b2.industry, 'arm_a_sophia_basic', 1, 'A2', {
        measuredInferenceCostMicroUsd: missingCost,
        realPaidInferenceCostMicroUsd: 0,
      }),
      makeLiveTrial(b2.briefId, b2.industry, 'arm_b_direct_model', 1, 'B2'),
    ];
    const { armKeyMap: liveKeyMap } = buildBlindEvaluationPackets(partialLiveTrials, [brief, b2], {
      rubricVersion: bundle.rubric.rubricVersion,
      seed: 'seed-partial',
    });
    const partialReport = buildBenchmarkReport({
      config: liveConfig,
      rubric: bundle.rubric,
      trials: partialLiveTrials,
      armKeyMap: liveKeyMap,
      reviewerScores: [],
    });

    expect(partialReport.arms.arm_a_sophia_basic.totalMeasuredInferenceCostMicroUsd.status).toBe('NOT_MEASURED');
    expect(partialReport.arms.arm_a_sophia_basic.totalEstimatedInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 3450,
    });
    expect(partialReport.arms.arm_b_direct_model.totalMeasuredInferenceCostMicroUsd).toEqual({
      status: 'OBSERVED',
      value: 3450,
    });
    expect(partialReport.realInferenceCostStatus).toBe('NOT_MEASURED');
  });

  it('rejects all 7 invalid trial-mapping and pairing tamper conditions', () => {
    const bundle = loadBundle();
    const brief = bundle.briefs[0];
    const config = makeConfig(
      'live_observed',
      bundle.manifest.datasetSha256,
      bundle.rubric.rubricVersion,
      bundle.manifest.rubricSha256,
    );
    const armA = makeLiveTrial(brief.briefId, brief.industry, 'arm_a_sophia_basic', 1, 'Arm A output');
    const armB = makeLiveTrial(brief.briefId, brief.industry, 'arm_b_direct_model', 1, 'Arm B output');
    const trials = [armA, armB];
    const { armKeyMap } = buildBlindEvaluationPackets(trials, [brief], {
      rubricVersion: bundle.rubric.rubricVersion,
      seed: 'seed-f3',
    });

    // 1. trialNumber mismatch
    const badTrialNum: BlindAssignmentKeyEntry[] = armKeyMap.map((k, idx) =>
      idx === 0 ? { ...k, trialNumber: 2 } : k,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: badTrialNum, reviewerScores: [] }),
    ).toThrow(/trialNumber mismatch/);

    // 2. Incomplete armKeyMap coverage
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: [armKeyMap[0]], reviewerScores: [] }),
    ).toThrow(/trial coverage mismatch/);

    // 3. Missing paired arm
    expect(() =>
      buildBenchmarkReport({
        config,
        rubric: bundle.rubric,
        trials: [armA],
        armKeyMap: armKeyMap.filter((k) => k.trialId === armA.trialId),
        reviewerScores: [],
      }),
    ).toThrow(/Missing paired arm/);

    // 4. Mismatched briefId
    const badBriefId: BlindAssignmentKeyEntry[] = armKeyMap.map((k, idx) =>
      idx === 0 ? { ...k, briefId: bundle.briefs[1].briefId } : k,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: badBriefId, reviewerScores: [] }),
    ).toThrow(/briefId mismatch/);

    // 5. Mismatched outputSha256
    const badHash: BlindAssignmentKeyEntry[] = armKeyMap.map((k, idx) =>
      idx === 0 ? { ...k, outputSha256: '0'.repeat(64) } : k,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: badHash, reviewerScores: [] }),
    ).toThrow(/outputSha256 mismatch/);

    // 6. Duplicate or unknown trialId
    const dupTrialId: BlindAssignmentKeyEntry[] = [
      armKeyMap[0],
      { ...armKeyMap[1], trialId: armKeyMap[0].trialId },
    ];
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: dupTrialId, reviewerScores: [] }),
    ).toThrow(/Duplicate trialId/);

    const unknownTrialId: BlindAssignmentKeyEntry[] = armKeyMap.map((k, idx) =>
      idx === 0 ? { ...k, trialId: 'non-existent-trial' } : k,
    );
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: unknownTrialId, reviewerScores: [] }),
    ).toThrow(/unknown trialId/);

    // 7. Cross-arm key substitution
    const swappedArms: BlindAssignmentKeyEntry[] = armKeyMap.map((k) => ({
      ...k,
      armId: k.armId === 'arm_a_sophia_basic' ? 'arm_b_direct_model' : 'arm_a_sophia_basic',
    }));
    expect(() =>
      buildBenchmarkReport({ config, rubric: bundle.rubric, trials, armKeyMap: swappedArms, reviewerScores: [] }),
    ).toThrow(/armKeyMap arm mismatch/);
  });
});
