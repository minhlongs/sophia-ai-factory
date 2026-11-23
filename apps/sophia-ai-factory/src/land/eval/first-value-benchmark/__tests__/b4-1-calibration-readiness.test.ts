import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBlindEvaluationPackets,
  buildBlindReviewerTemplate,
  buildStage1CalibrationManifest,
  computeObservedCallCostMicroUsd,
  computePrimaryPairedAnalysis,
  computeSha256Hex,
  evaluateStage1StopConditions,
  installBenchmarkZeroNetworkGuard,
  LIVE_ADAPTER_ENABLED_BY_DEFAULT,
  PINNED_MODEL_CONTRACTS,
  runBudgetGatedCalibration,
  SOPHIA_BASIC_CALL_GRAPH_CONTRACT,
  verifyFrozenDataset,
  verifyFrozenRubric,
  verifyModelVersionParity,
  verifyStage1CalibrationManifest,
  type ReviewerScoreRecord,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');

function loadAssets() {
  const datasetRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
  const manifestRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
  const rubricRaw = fs.readFileSync(path.join(EVAL_DIR, 'rubric-v1.json'), 'utf8');
  const stage1Raw = fs.readFileSync(path.join(EVAL_DIR, 'stage1-calibration-manifest-v1.json'), 'utf8');
  const dataset = verifyFrozenDataset(datasetRaw, manifestRaw);
  const rubric = verifyFrozenRubric(rubricRaw, dataset.manifest.rubricSha256).rubric;
  const bundle = { ...dataset, rubric };
  const stage1 = verifyStage1CalibrationManifest(stage1Raw, bundle.briefs, bundle.manifest);
  return { bundle, stage1, datasetRaw, rubricRaw };
}

describe('B4.1 Stage 1 calibration manifest, model contract, live adapter, and paired statistics', () => {
  it('verifies frozen dataset/rubric hashes and frozen 10-brief Stage 1 manifest (5 verticals x 1 EN + 1 VI)', () => {
    const { bundle, stage1, datasetRaw, rubricRaw } = loadAssets();
    expect(computeSha256Hex(datasetRaw)).toBe(
      '80e2f2aec64a0ac21446e92b87fc3ac6632164fa158bfe7ea8ec76221ccaf2ff',
    );
    expect(computeSha256Hex(rubricRaw)).toBe(
      '31dbffd556f12957a3a643bb3fb3efa0d1fb2447e75db50809cfd4bd10fc77fd',
    );
    expect(stage1.manifest.selectedBriefIds).toHaveLength(10);
    expect(stage1.manifest.languageDistribution).toEqual({ en: 5, vi: 5 });
    expect(stage1.manifest.languageFallbackVerticals).toEqual([]);
    expect(stage1.manifest.fullDatasetLanguageImbalance).toEqual({ en: 33, vi: 17 });
    expect(stage1.manifest.plannedLogicalTrials).toBe(20);
    expect(stage1.manifest.callGraphPlan.spendingAuthorized).toBe(false);

    // Deterministic rebuild matches frozen manifest SHA-256 byte-for-byte
    const rebuilt = buildStage1CalibrationManifest({
      briefs: bundle.briefs,
      datasetManifest: bundle.manifest,
    });
    expect(rebuilt.manifestSha256).toBe(stage1.manifest.manifestSha256);

    // Fallback works deterministically if a vertical lacks Vietnamese briefs
    const enOnlyBriefs = bundle.briefs.map((b) =>
      b.industry === 'coffee_and_food_service' ? { ...b, language: 'en' as const } : b,
    );
    const fallbackManifest = buildStage1CalibrationManifest({
      briefs: enOnlyBriefs,
      datasetManifest: bundle.manifest,
    });
    expect(fallbackManifest.languageFallbackVerticals).toEqual(['coffee_and_food_service']);
    expect(fallbackManifest.verticalDistribution.coffee_and_food_service).toBe(2);
  });

  it('enforces call-graph reconciliation and MODEL_PARITY_UNVERIFIED on unpinned model aliases', () => {
    expect(SOPHIA_BASIC_CALL_GRAPH_CONTRACT.productionTransportWorstCaseCallsPerTrial).toBe(4);
    expect(SOPHIA_BASIC_CALL_GRAPH_CONTRACT.stage1BoundedMaxCallsPerTrial).toBe(2);
    expect(SOPHIA_BASIC_CALL_GRAPH_CONTRACT.stage1RunMaxBillableCallsCeiling).toBe(30);

    const openaiContract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const anthropicContract = PINNED_MODEL_CONTRACTS['claude-haiku-5-5'];

    expect(
      verifyModelVersionParity(openaiContract, {
        provider: 'openai',
        requestedModelId: 'gpt-5.4-mini-2026-03-17',
        responseModelId: 'gpt-5.4-mini-2026-03-17',
        modelFingerprint: 'fp_2026_03',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
      }).status,
    ).toBe('VERIFIED');

    const aliasParity = verifyModelVersionParity(anthropicContract, {
      provider: 'anthropic',
      requestedModelId: 'claude-haiku-5-5',
      responseModelId: 'claude-haiku-5-5',
      modelFingerprint: null,
      requestTimestampIso: '2026-11-23T00:00:00.000Z',
    });
    expect(aliasParity.status).toBe('MODEL_PARITY_UNVERIFIED');
    expect(aliasParity.reasons).toContain('contract_snapshot_not_immutable');

    // Integer microUSD cost calculation with cached tokens
    const cost = computeObservedCallCostMicroUsd(openaiContract, {
      promptTokens: 1000,
      cachedPromptTokens: 400,
      completionTokens: 500,
    });
    // 600 * 0.75 + 400 * 0.075 + 500 * 4.5 = 450 + 30 + 2250 = 2730
    expect(cost).toBe(2730);
  });

  it('runs disabled-by-default adapter on mock transport with zero network calls and rejects unauthorized live mode', async () => {
    const { stage1 } = loadAssets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    expect(LIVE_ADAPTER_ENABLED_BY_DEFAULT).toBe(false);

    // Live mode rejected by default
    await expect(
      runBudgetGatedCalibration({
        mode: 'live_provider',
        manifest: stage1.manifest,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: contract,
      }),
    ).rejects.toThrow(/LIVE_EXECUTION_DISABLED/);

    // Live mode with opt-in still rejected without authorization record
    await expect(
      runBudgetGatedCalibration({
        mode: 'live_provider',
        liveExecutionEnabled: true,
        manifest: stage1.manifest,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: contract,
      }),
    ).rejects.toThrow(/LIVE_AUTHORIZATION_REQUIRED/);

    // Mismatched selectedBriefs rejected before execution
    await expect(
      runBudgetGatedCalibration({
        manifest: stage1.manifest,
        selectedBriefs: stage1.selectedBriefs.slice(0, 2),
        pricingContract: contract,
      }),
    ).rejects.toThrow(/MANIFEST_BRIEF_MISMATCH/);

    // Transport exception reconciles failure as uncertain liability and halts cleanly
    const throwingRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => {
        throw new Error('simulated_socket_reset');
      },
    });
    expect(throwingRun.haltedReason).toBe('UNCERTAIN_FAILURE:TRANSPORT_EXCEPTION');
    expect(throwingRun.costGovernorSnapshot.reservedMicroUsd).toBe(0);
    expect(throwingRun.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);
    expect(throwingRun.costGovernorSnapshot.spendEvidenceStatus).toBe('UNCERTAIN_FAILED_CALL');
    expect(throwingRun.receipts).toHaveLength(1);
    expect(throwingRun.receipts[0].outcome).toBe('FAILED_TERMINAL');

    // Default mock transport runs all 20 Stage 1 trials offline with zero network calls
    const guard = installBenchmarkZeroNetworkGuard();
    const run = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
    }).finally(() => guard.restore());
    expect(run.transportMode).toBe('mock_transport');
    expect(run.nextStageAutoStart).toBe(false);
    expect(run.haltedReason).toBeNull();
    expect(run.trials).toHaveLength(20);
    expect(run.receipts).toHaveLength(20);
    expect(run.costGovernorSnapshot.reservedMicroUsd).toBe(0);
    expect(run.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBe(0);

    const stopReport = evaluateStage1StopConditions({
      run,
      expectedBriefIds: stage1.manifest.selectedBriefIds,
      pricingContract: contract,
      blindPacketLeakageFree: true,
      trialMappingComplete: true,
    });
    expect(stopReport.verdict).toBe('STAGE1_OPERATIONAL_PASS');
    expect(stopReport.autoStartStage2).toBe(false);
    expect(stopReport.failedGateCodes).toEqual([]);

    // Operational stop triggers if blind packet leaks or trial mapping is incomplete
    const failedStop = evaluateStage1StopConditions({
      run,
      expectedBriefIds: stage1.manifest.selectedBriefIds,
      pricingContract: contract,
      blindPacketLeakageFree: false,
      trialMappingComplete: false,
    });
    expect(failedStop.verdict).toBe('STAGE1_STOP_AND_PRESERVE_EVIDENCE');
    expect(failedStop.failedGateCodes).toContain('NO_CROSS_ARM_LEAKAGE');
    expect(failedStop.failedGateCodes).toContain('NO_MISSING_TRIAL_MAPPING');
  });

  it('computes brief-level paired Delta, blocks superiority claims in Stage 1, and runs cluster bootstrap in Stage 2', () => {
    const { bundle, stage1 } = loadAssets();
    const trials: TrialExecutionRecord[] = [];
    for (const brief of stage1.selectedBriefs) {
      for (let t = 1; t <= 3; t++) {
        for (const armId of ['arm_a_sophia_basic', 'arm_b_direct_model'] as const) {
          const variantLabel = armId === 'arm_a_sophia_basic' ? 'structured' : 'plain';
          const text = `Output ${brief.briefId} ${variantLabel} t${t}`;
          trials.push({
            trialId: `${brief.briefId}:${armId}:t${t}`,
            briefId: brief.briefId,
            industry: brief.industry,
            armId,
            trialNumber: t,
            executionMode: 'live_observed',
            qualityStatus: 'QUALITY_NOT_MEASURED',
            inputSha256: computeSha256Hex(`in:${brief.briefId}:${armId}:${t}`),
            outputSha256: computeSha256Hex(text),
            renderedOutput: text,
            orchestrationNotes: 'paired analysis fixture',
            telemetry: {
              modelId: 'gpt-5.4-mini-2026-03-17',
              modelVersion: 'gpt-5.4-mini-2026-03-17',
              retryCount: 0,
              wallClockLatencyMs: { status: 'OBSERVED', value: 1000 },
              promptTokens: { status: 'OBSERVED', value: 300 },
              completionTokens: { status: 'OBSERVED', value: 200 },
              estimatedInferenceCostMicroUsd: { status: 'OBSERVED', value: 1125 },
              measuredInferenceCostMicroUsd: { status: 'OBSERVED', value: 1125 },
              realPaidInferenceCostMicroUsd: 1125,
              infrastructureCostAllocationMicroUsd: 0,
            },
          });
        }
      }
    }

    const { reviewerPacket, armKeyMap } = buildBlindEvaluationPackets(trials, stage1.selectedBriefs, {
      rubricVersion: bundle.rubric.rubricVersion,
      seed: 'seed-stats',
    });
    const template = buildBlindReviewerTemplate(reviewerPacket, stage1.selectedBriefs, bundle.rubric);
    expect(template).toHaveLength(60);

    const scores: ReviewerScoreRecord[] = armKeyMap.map((entry) => {
      const accept = entry.armId === 'arm_a_sophia_basic';
      return {
        reviewerId: 'rev-1',
        blindOutputId: entry.blindOutputId,
        rubricVersion: bundle.rubric.rubricVersion,
        scoringOrigin: 'human_independent',
        criterionScores: {
          hook_clarity: accept ? 5 : 2,
          logical_structure: accept ? 5 : 2,
          cta_relevance: accept ? 5 : 2,
          brand_and_audience_fit: accept ? 5 : 2,
          compliance_and_publishability: accept ? 5 : 2,
        },
        accepted: accept,
        rejectionReason: accept ? null : 'Insufficient structure.',
        estimatedEditingMinutes: accept ? 4 : 15,
        founderSupportMinutes: 0,
      };
    });

    // Stage 1: brief-level paired count is 10 (NOT 30 or 60!), superiority claim blocked
    const stage1Analysis = computePrimaryPairedAnalysis({
      stage: 'stage1_calibration',
      briefs: stage1.selectedBriefs,
      armKeyMap,
      reviewerScores: scores,
    });
    expect(stage1Analysis.briefPairsCount).toBe(10);
    expect(stage1Analysis.primaryDelta).toBe(1);
    expect(stage1Analysis.statisticalSuperiorityClaimAllowed).toBe(false);
    expect(stage1Analysis.clusterBootstrap).toBeNull();
    expect(stage1Analysis.languageStratified.en.pairedBriefs).toBe(5);
    expect(stage1Analysis.languageStratified.vi.pairedBriefs).toBe(5);
    expect(stage1Analysis.languageStratified.datasetImbalanceDisclosure).toContain('33 EN / 17 VI');

    // Stage 2: cluster bootstrap runs deterministically at brief level
    const stage2Analysis = computePrimaryPairedAnalysis({
      stage: 'stage2_full_benchmark',
      briefs: stage1.selectedBriefs,
      armKeyMap,
      reviewerScores: scores,
      bootstrapIterations: 200,
    });
    expect(stage2Analysis.clusterBootstrap?.briefPairsCount).toBe(10);
    expect(stage2Analysis.clusterBootstrap?.meanDelta).toBe(1);
    expect(stage2Analysis.clusterBootstrap?.ci95Lower).toBe(1);
    expect(stage2Analysis.clusterBootstrap?.ci95Upper).toBe(1);
  });
});
