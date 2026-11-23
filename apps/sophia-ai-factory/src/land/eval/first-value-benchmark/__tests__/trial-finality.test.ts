/**
 * Regression tests for trial cost finality, authoritative pair completion accounting,
 * deferred authorized usage reconciliation, and deterministic offline E2E drill.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildBenchmarkReport,
  buildBlindEvaluationPackets,
  computeSha256Hex,
  computeStage1ManifestSha256,
  countAuthoritativePairCompletions,
  createDeterministicMockTransport,
  createEphemeralTestFounderKeypair,
  evaluateTrialFinality,
  ExperimentCostGovernor,
  FOUNDER_AUTH_DOMAIN,
  FOUNDER_AUTH_SCHEMA_VERSION,
  FOUNDER_RECONCILIATION_DOMAIN,
  InMemoryAuthorizationNonceLedger,
  installBenchmarkZeroNetworkGuard,
  isTrialFinalizedCompleted,
  PINNED_MODEL_CONTRACTS,
  reconcileDeferredTrialUsage,
  runBudgetGatedCalibration,
  STAGE1_DEFAULT_TARGET_DURATION_SEC,
  STAGE1_EXPERIMENTAL_CONFIG,
  verifyFrozenDataset,
  verifyFrozenRubric,
  verifyStage1CalibrationManifest,
  type AdapterTrialEvidence,
  type DeferredUsageReconciliationPayload,
  type DeferredUsageReconciliationRecord,
  type EvalTransportFn,
  type ExperimentAuthorizationPayload,
  type ExperimentAuthorizationRecord,
  type ExperimentConfig,
  type FinalityReceipt,
  type Stage1CalibrationManifest,
  type TrialExecutionRecord,
  type ZeroNetworkGuardHandle,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');
const TEST_FOUNDER_KEYPAIR = createEphemeralTestFounderKeypair('test-founder-ed25519-finality');
const CONTRACT = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

function loadAssets() {
  const datasetRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
  const manifestRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
  const rubricRaw = fs.readFileSync(path.join(EVAL_DIR, 'rubric-v1.json'), 'utf8');
  const stage1Raw = fs.readFileSync(path.join(EVAL_DIR, 'stage1-calibration-manifest-v1.json'), 'utf8');
  const dataset = verifyFrozenDataset(datasetRaw, manifestRaw);
  const rubric = verifyFrozenRubric(rubricRaw, dataset.manifest.rubricSha256).rubric;
  const stage1 = verifyStage1CalibrationManifest(stage1Raw, dataset.briefs, dataset.manifest);
  return { dataset, rubric, stage1 };
}

function buildSignedAuth(
  manifest: Stage1CalibrationManifest,
  overrides?: Partial<ExperimentAuthorizationPayload>,
): ExperimentAuthorizationRecord {
  const payload: ExperimentAuthorizationPayload = {
    schemaVersion: FOUNDER_AUTH_SCHEMA_VERSION,
    domain: FOUNDER_AUTH_DOMAIN,
    authorizationId: 'TEST-FINALITY-AUTH-001',
    experimentRunId: 'run-finality-001',
    authorizationNonce: 'nonce-finality-001',
    founderSignerKeyId: TEST_FOUNDER_KEYPAIR.trustAnchor.signerKeyId,
    approvedBy: 'founder-test-signer',
    approvedAtIso: '2026-11-23T00:00:00.000Z',
    expiresAtIso: '2026-11-24T00:00:00.000Z',
    stage: 'STAGE1',
    manifestVersion: manifest.protocolVersion,
    manifestSha256: computeStage1ManifestSha256(manifest),
    datasetSha256: manifest.datasetSha256,
    rubricSha256: manifest.rubricSha256,
    randomSeed: manifest.randomSeed,
    selectedBriefIds: [...manifest.selectedBriefIds],
    modelId: CONTRACT.modelId,
    pricingVersion: CONTRACT.pricingVersion,
    maxOutputTokensCap: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
    reasoningEffort: STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort,
    temperature: STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature,
    maxRetriesPerTrial: manifest.callGraphPlan.maxRetriesPerTrial,
    authorizedCeilingMicroUsd: manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    maxBillableCalls: manifest.callGraphPlan.runMaxBillableCallsCeiling,
    permittedEnvironment: 'offline_test_harness',
    providerProjectId: 'proj_test_stage1_isolated',
    providerSpendingCapConfirmed: true,
    ...overrides,
  };
  return TEST_FOUNDER_KEYPAIR.signAuthorization(payload);
}

function buildExperimentConfig(
  dataset: ReturnType<typeof loadAssets>['dataset'],
  rubric: ReturnType<typeof loadAssets>['rubric'],
  manifest: Stage1CalibrationManifest,
): ExperimentConfig {
  return {
    configVersion: 'b4-config-v1.0.0',
    datasetVersion: dataset.manifest.datasetVersion,
    datasetSha256: dataset.manifest.datasetSha256,
    rubricVersion: rubric.rubricVersion,
    rubricSha256: dataset.manifest.rubricSha256,
    mode: 'live_observed',
    trialsPerBrief: 1,
    targetDurationSec: STAGE1_DEFAULT_TARGET_DURATION_SEC,
    randomSeed: manifest.randomSeed,
    plannedModelId: CONTRACT.modelId,
    plannedModelVersion: CONTRACT.modelId,
    temperature: STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature,
    maxOutputTokensBudget: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
  };
}

describe('Trial Cost Finality & Authoritative Pair Completion Accounting', () => {
  let networkGuard: ZeroNetworkGuardHandle | null = null;

  beforeEach(() => {
    networkGuard = installBenchmarkZeroNetworkGuard();
  });

  afterEach(() => {
    networkGuard?.restore();
    networkGuard = null;
  });

  it('1. counts completed pairs when both arms return valid outputs with measured usage', async () => {
    const { stage1 } = loadAssets();
    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s1' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: createDeterministicMockTransport(CONTRACT),
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBeNull();
    expect(result.completedPairsCount).toBe(10);
    expect(result.trials).toHaveLength(20);
    expect(result.trials.every((t) => t.status === 'COMPLETED')).toBe(true);
    expect(result.costGovernorSnapshot.completedTrialIds).toHaveLength(20);
    expect(result.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBe(0);

    // Single pair check on the first brief
    const firstBriefId = stage1.selectedBriefs[0].briefId;
    const singlePair = countAuthoritativePairCompletions({
      trials: result.trials.filter((t) => t.briefId === firstBriefId),
      governorSnapshot: result.costGovernorSnapshot,
      receipts: result.receipts,
      selectedBriefIds: [firstBriefId],
    });
    expect(singlePair.completedPairs).toBe(1);
  });

  it('2 & 13. counts zero completed pairs and halts fail-closed when Arm A is valid and Arm B is missing usage', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armBMissingUsage: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return req.armId === 'arm_b_direct_model'
        ? { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined }
        : resp;
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s2' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armBMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBe('MISSING_USAGE_METADATA');
    expect(result.completedPairsCount).toBe(0);
    expect(result.trials).toHaveLength(2);
    expect(result.trials[0].status).toBe('COMPLETED');
    expect(result.trials[1].status).toBe('COST_RECONCILIATION_REQUIRED');
    expect(result.costGovernorSnapshot.completedTrialIds).toEqual([result.trials[0].trialId]);
    expect(result.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);
    expect(
      result.costGovernorSnapshot.unresolvedLiabilityByTrialMicroUsd?.[result.trials[1].trialId],
    ).toBeGreaterThan(0);
  });

  it('3. counts zero completed pairs when Arm A is missing usage and Arm B is valid', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armAMissingUsage: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return req.armId === 'arm_a_sophia_basic'
        ? { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined }
        : resp;
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s3' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armAMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBe('MISSING_USAGE_METADATA');
    expect(result.completedPairsCount).toBe(0);
    expect(result.trials[0].status).toBe('COST_RECONCILIATION_REQUIRED');
    expect(result.costGovernorSnapshot.completedTrialIds).toHaveLength(0);
  });

  it('4. counts zero completed pairs when both arms are missing usage', () => {
    const { stage1 } = loadAssets();
    const briefId = stage1.selectedBriefs[0].briefId;
    const governor = new ExperimentCostGovernor({
      plannedLogicalTrials: 20,
      plannedProviderCalls: 20,
      maxBillableCalls: 30,
      maxRetriesPerTrial: 1,
      authorizedCeilingMicroUsd: 3_000_000,
      maxPromptTokensBudget: 2000,
      maxOutputTokensCap: 1200,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: CONTRACT,
    });
    const trialA = `${briefId}:arm_a_sophia_basic:stage1`;
    const trialB = `${briefId}:arm_b_direct_model:stage1`;
    const admA = governor.admitCall({
      trialId: trialA,
      attemptNumber: 1,
      modelId: CONTRACT.modelId,
      pricingVersion: CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1200,
    });
    if (!admA.admitted) throw new Error('expected admission');
    governor.reconcileSuccess(admA.admissionId, { promptTokens: null, completionTokens: null });
    const snapshot = governor.exportSnapshot();

    const summary = countAuthoritativePairCompletions({
      trials: [
        {
          trialId: trialA,
          briefId,
          armId: 'arm_a_sophia_basic',
          status: 'COST_RECONCILIATION_REQUIRED',
          outputContractValid: true,
          providerResponseId: 'resp-a',
          providerModelVersion: CONTRACT.modelId,
          outputSha256: computeSha256Hex('output-a'),
          observedCostMicroUsd: null,
          trialRecord: null,
        },
        {
          trialId: trialB,
          briefId,
          armId: 'arm_b_direct_model',
          status: 'COST_RECONCILIATION_REQUIRED',
          outputContractValid: true,
          providerResponseId: 'resp-b',
          providerModelVersion: CONTRACT.modelId,
          outputSha256: computeSha256Hex('output-b'),
          observedCostMicroUsd: null,
          trialRecord: null,
        },
      ],
      governorSnapshot: snapshot,
      receipts: [],
    });

    expect(summary.completedPairs).toBe(0);
    expect(summary.completedTrialIds).toEqual([]);
  });

  it('5. preserves valid output artifact on missing token usage without marking COMPLETED or zeroing cost', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const missingTokensTransport: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined };
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s5' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: missingTokensTransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const trial = result.trials[0];
    expect(trial.status).toBe('COST_RECONCILIATION_REQUIRED');
    expect(trial.outputContractValid).toBe(true);
    expect(trial.observedCostMicroUsd).toBeNull();
    expect(trial.trialRecord).not.toBeNull();
    expect(trial.trialRecord?.renderedOutput.length).toBeGreaterThan(20);
    expect(trial.trialRecord?.telemetry.measuredInferenceCostMicroUsd.status).toBe('NOT_MEASURED');
    expect(trial.trialRecord?.telemetry.promptTokens.status).toBe('NOT_MEASURED');
    expect(trial.trialRecord?.telemetry.completionTokens.status).toBe('NOT_MEASURED');
    expect(result.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);
    expect(
      isTrialFinalizedCompleted(trial, {
        governorSnapshot: result.costGovernorSnapshot,
        receipts: result.receipts,
      }),
    ).toBe(false);
  });

  it('6. does not mark trial COMPLETED when output is rejected by the arm parser', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const invalidJsonTransport: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return { ...resp, renderedOutput: 'not valid json for arm a contract' };
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s6' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: invalidJsonTransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const armATrial = result.trials[0];
    expect(armATrial.status).toBe('FAILED');
    expect(armATrial.outputContractValid).toBe(false);
    expect(result.completedPairsCount).toBe(0);
    expect(
      isTrialFinalizedCompleted(armATrial, {
        governorSnapshot: result.costGovernorSnapshot,
        receipts: result.receipts,
      }),
    ).toBe(false);
  });

  it('7. retains unresolved provider-charge liability on timeout after possible provider acceptance', async () => {
    const { stage1 } = loadAssets();
    const timeoutTransport: EvalTransportFn = async () => {
      throw new Error('ETIMEDOUT: socket hang up after request sent');
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s7' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: timeoutTransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const armATrial = result.trials[0];
    expect(armATrial.status).toBe('FAILED');
    expect(result.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);
    expect(
      result.costGovernorSnapshot.unresolvedLiabilityByTrialMicroUsd?.[armATrial.trialId],
    ).toBeGreaterThan(0);
    expect(result.completedPairsCount).toBe(0);
  });

  it('8. prevents duplicate completion when duplicate receipts or trial entries are replayed', async () => {
    const { stage1 } = loadAssets();
    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s8' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: createDeterministicMockTransport(CONTRACT),
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const duplicatedSummary = countAuthoritativePairCompletions({
      trials: [...result.trials, ...result.trials],
      governorSnapshot: result.costGovernorSnapshot,
      receipts: [...result.receipts, ...result.receipts],
      selectedBriefIds: stage1.manifest.selectedBriefIds,
    });

    expect(duplicatedSummary.completedPairs).toBe(10);
    expect(duplicatedSummary.completedTrialIds).toHaveLength(20);
  });

  it('9. preserves identical finality state across worker/process restart via governor snapshot serialization', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armBMissingUsage: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return req.armId === 'arm_b_direct_model'
        ? { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined }
        : resp;
    };

    const firstRun = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s9' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armBMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const serialized = JSON.stringify(firstRun.costGovernorSnapshot);
    const restoredGovernor = ExperimentCostGovernor.fromSnapshot(
      {
        plannedLogicalTrials: 20,
        plannedProviderCalls: 20,
        maxBillableCalls: stage1.manifest.callGraphPlan.runMaxBillableCallsCeiling,
        maxRetriesPerTrial: stage1.manifest.callGraphPlan.maxRetriesPerTrial,
        authorizedCeilingMicroUsd: stage1.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
        maxPromptTokensBudget: 2000,
        maxOutputTokensCap: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
        spendingAuthorized: true,
        providerSpendingCapConfirmed: true,
        pricingContract: CONTRACT,
      },
      JSON.parse(serialized),
    );
    const restoredSnapshot = restoredGovernor.exportSnapshot();

    const beforeRestart = countAuthoritativePairCompletions({
      trials: firstRun.trials,
      governorSnapshot: firstRun.costGovernorSnapshot,
      receipts: firstRun.receipts,
    });
    const afterRestart = countAuthoritativePairCompletions({
      trials: firstRun.trials,
      governorSnapshot: restoredSnapshot,
      receipts: firstRun.receipts,
    });

    expect(afterRestart).toEqual(beforeRestart);
    expect(afterRestart.completedPairs).toBe(0);
    expect(restoredSnapshot.unresolvedLiabilityByTrialMicroUsd).toEqual(
      firstRun.costGovernorSnapshot.unresolvedLiabilityByTrialMicroUsd,
    );
  });

  it('10. accepts exactly one completion when attempt 1 fails retryably and attempt 2 returns valid reconciled usage', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const firstBriefId = stage1.selectedBriefs[0].briefId;
    let firstArmAAttempts = 0;
    const flakyArmATransport: EvalTransportFn = async (req) => {
      if (req.brief.briefId === firstBriefId && req.armId === 'arm_a_sophia_basic') {
        firstArmAAttempts += 1;
        if (firstArmAAttempts === 1) {
          return {
            ok: false,
            failureClass: 'RATE_LIMITED_429',
            retryable: true,
            acceptedByProvider: false,
            httpStatus: 429,
            message: '429 rate_limit_exceeded',
            requestTimestampIso: '2026-11-23T12:00:00.000Z',
          };
        }
      }
      return baseTransport(req);
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s10' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: flakyArmATransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(firstArmAAttempts).toBe(2);
    expect(result.haltedReason).toBeNull();
    expect(result.completedPairsCount).toBe(10);
    expect(result.trials[0].status).toBe('COMPLETED');
    expect(result.costGovernorSnapshot.retryCount).toBe(1);
    expect(
      result.costGovernorSnapshot.completedTrialIds.filter((id) => id === result.trials[0].trialId),
    ).toHaveLength(1);
  });

  it('11. ensures cost governor and authoritative pair counter agree exactly', async () => {
    const { stage1 } = loadAssets();
    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s11' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: createDeterministicMockTransport(CONTRACT),
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const summary = countAuthoritativePairCompletions({
      trials: result.trials,
      governorSnapshot: result.costGovernorSnapshot,
      receipts: result.receipts,
      selectedBriefIds: stage1.manifest.selectedBriefIds,
    });

    expect(result.completedPairsCount).toBe(10);
    expect(summary.completedPairs).toBe(10);
    expect([...summary.completedTrialIds].sort()).toEqual(
      [...result.costGovernorSnapshot.completedTrialIds].sort(),
    );
  });

  it('12. report builder rejects contradictory completion evidence', async () => {
    const { dataset, rubric, stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armBMissingUsage: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return req.armId === 'arm_b_direct_model'
        ? { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined }
        : resp;
    };

    const run = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s12' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armBMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const reportTrials = run.trials
      .map((t) => t.trialRecord)
      .filter((r): r is TrialExecutionRecord => r !== null);
    const blindPacket = buildBlindEvaluationPackets(reportTrials, stage1.selectedBriefs, {
      seed: stage1.manifest.randomSeed,
      rubricVersion: rubric.rubricVersion,
    });
    const config = buildExperimentConfig(dataset, rubric, stage1.manifest);

    // Attempt to forge COMPLETED status on the unreconciled Arm B evidence
    const forgedEvidence: AdapterTrialEvidence[] = run.trials.map((t, idx) =>
      idx === 1 ? { ...t, status: 'COMPLETED' } : t,
    );

    expect(() =>
      buildBenchmarkReport({
        config,
        rubric,
        trials: reportTrials,
        armKeyMap: blindPacket.armKeyMap,
        reviewerScores: [],
        completionFinalityEvidence: {
          adapterEvidence: forgedEvidence,
          governorSnapshot: run.costGovernorSnapshot,
          receipts: run.receipts,
        },
      }),
    ).toThrow(/CONTRADICTORY_COMPLETION_EVIDENCE/);
  });

  it('14. keeps a partial run auditable and never counts it as ten completed pairs', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    let callCount = 0;
    const failOnPair4ArmB: EvalTransportFn = async (req) => {
      callCount += 1;
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      if (callCount === 8) {
        return { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined };
      }
      return resp;
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-s14' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: failOnPair4ArmB,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBe('MISSING_USAGE_METADATA');
    expect(result.completedPairsCount).toBe(3);
    expect(result.completedPairsCount).not.toBe(10);
    expect(result.trials).toHaveLength(8);
    expect(result.trials[7].status).toBe('COST_RECONCILIATION_REQUIRED');
    expect(result.trials[7].trialRecord).not.toBeNull();
    expect(result.receipts).toHaveLength(8);
  });

  it('15. completes an unreconciled trial only through an explicit signed authorized usage reconciliation transition', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armBMissingUsage: EvalTransportFn = async (req) => {
      const resp = await baseTransport(req);
      if (!resp.ok) return resp;
      return req.armId === 'arm_b_direct_model'
        ? { ...resp, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined }
        : resp;
    };

    const run = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, {
        experimentRunId: 'run-deferred-reconcile-001',
        authorizationNonce: 'nonce-s15',
      }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armBMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(run.completedPairsCount).toBe(0);
    const unreconciledTrial = run.trials[1];
    expect(unreconciledTrial.status).toBe('COST_RECONCILIATION_REQUIRED');

    const reconciliationPayload: DeferredUsageReconciliationPayload = {
      domain: FOUNDER_RECONCILIATION_DOMAIN,
      manifestSha256: computeStage1ManifestSha256(stage1.manifest),
      trialId: unreconciledTrial.trialId,
      outputSha256: unreconciledTrial.outputSha256!,
      promptTokens: 320,
      completionTokens: 480,
      founderSignerKeyId: TEST_FOUNDER_KEYPAIR.trustAnchor.signerKeyId,
      reconciledAtIso: '2026-11-23T13:00:00.000Z',
    };

    // Forged / attacker-signed reconciliation MUST be rejected
    const attackerKeypair = createEphemeralTestFounderKeypair('test-founder-ed25519-finality');
    const forgedRecord: DeferredUsageReconciliationRecord = {
      payload: reconciliationPayload,
      signatureAlgorithm: 'Ed25519',
      signatureBase64: attackerKeypair.signDomainPayload(
        FOUNDER_RECONCILIATION_DOMAIN,
        reconciliationPayload,
      ),
    };

    expect(() =>
      reconcileDeferredTrialUsage({
        runResult: run,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: CONTRACT,
        reconciliation: forgedRecord,
        trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      }),
    ).toThrow(/SIGNATURE_INVALID/);

    // Valid Founder-signed reconciliation transitions the trial cleanly to COMPLETED
    const signedRecord: DeferredUsageReconciliationRecord = {
      payload: reconciliationPayload,
      signatureAlgorithm: 'Ed25519',
      signatureBase64: TEST_FOUNDER_KEYPAIR.signDomainPayload(
        FOUNDER_RECONCILIATION_DOMAIN,
        reconciliationPayload,
      ),
    };
    const reconciled = reconcileDeferredTrialUsage({
      runResult: run,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      reconciliation: signedRecord,
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
    });

    expect(reconciled.completedPairsCount).toBe(1);
    expect(reconciled.trials[1].status).toBe('COMPLETED');
    expect(reconciled.trials[1].observedCostMicroUsd).toBeGreaterThan(0);
    expect(reconciled.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBe(0);
    expect(reconciled.costGovernorSnapshot.completedTrialIds).toHaveLength(2);
    const check = evaluateTrialFinality(reconciled.trials[1], {
      governorSnapshot: reconciled.costGovernorSnapshot,
      receipts: reconciled.receipts as readonly FinalityReceipt[],
    });
    expect(check.completed).toBe(true);
    expect(check.reasons).toEqual([]);
  });

  it('deterministic offline E2E drill: completes all 10 Stage 1 pairs with signed authorization, nonce ledger, and report builder finality check', async () => {
    const { dataset, rubric, stage1 } = loadAssets();
    const ledger = new InMemoryAuthorizationNonceLedger();
    const auth = buildSignedAuth(stage1.manifest, {
      experimentRunId: 'run-e2e-offline-drill-001',
      authorizationNonce: 'nonce-e2e-offline-drill-001',
    });

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: auth,
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: ledger,
      liveTransport: createDeterministicMockTransport(CONTRACT),
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBeNull();
    expect(result.completedPairsCount).toBe(10);
    expect(result.trials).toHaveLength(20);
    expect(result.costGovernorSnapshot.completedTrialIds).toHaveLength(20);
    expect(result.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBe(0);
    expect(result.costGovernorSnapshot.actualSpendMicroUsd).toBeGreaterThan(0);
    expect(result.costGovernorSnapshot.actualSpendMicroUsd).toBeLessThanOrEqual(
      stage1.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    );

    const reportTrials = result.trials
      .map((t) => t.trialRecord)
      .filter((r): r is TrialExecutionRecord => r !== null);
    const blindPacket = buildBlindEvaluationPackets(reportTrials, stage1.selectedBriefs, {
      seed: stage1.manifest.randomSeed,
      rubricVersion: rubric.rubricVersion,
    });
    const config = buildExperimentConfig(dataset, rubric, stage1.manifest);

    const report = buildBenchmarkReport({
      config,
      rubric,
      trials: reportTrials,
      armKeyMap: blindPacket.armKeyMap,
      reviewerScores: [],
      completionFinalityEvidence: {
        adapterEvidence: result.trials,
        governorSnapshot: result.costGovernorSnapshot,
        receipts: result.receipts,
      },
    });

    expect(report.arms.arm_a_sophia_basic.liveObservedTrials).toBe(10);
    expect(report.arms.arm_b_direct_model.liveObservedTrials).toBe(10);
    expect(report.realInferenceCostStatus).toBe('OBSERVED');
    expect(report.comparativeQualityStatus).toBe('QUALITY_NOT_MEASURED');
    expect(report.customerAcceptanceStatus).toBe('NOT_PROVEN');
  });

  it('rejects missing responseModelId provenance and never marks the trial COMPLETED', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const missingModelTransport: EvalTransportFn = async (req) => {
      const res = await baseTransport(req);
      if (res.ok && req.armId === 'arm_b_direct_model') {
        return { ...res, responseModelId: null };
      }
      return res;
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-missing-model' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: missingModelTransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const armB = result.trials.find((t) => t.armId === 'arm_b_direct_model');
    expect(armB?.status).toBe('FAILED');
    expect(result.completedPairsCount).toBe(0);
    expect(result.costGovernorSnapshot.completedTrialIds).not.toContain(armB?.trialId);
  });

  it('fails closed on unattributed uncertain liability and completed-unresolved overlap in snapshot', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    const armBMissingUsage: EvalTransportFn = async (req) => {
      const res = await baseTransport(req);
      if (res.ok && req.armId === 'arm_b_direct_model') {
        return { ...res, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined };
      }
      return res;
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, { authorizationNonce: 'nonce-unattrib' }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: armBMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    const armA = result.trials.find((t) => t.armId === 'arm_a_sophia_basic')!;
    const strippedSnapshot = {
      ...result.costGovernorSnapshot,
      unresolvedLiabilityByTrialMicroUsd: {},
    };
    const check = evaluateTrialFinality(armA, {
      governorSnapshot: strippedSnapshot,
      receipts: result.receipts,
    });
    expect(check.completed).toBe(false);
    expect(check.reasons).toContain('unattributed_uncertain_liability');

    const govConfig = {
      plannedLogicalTrials: 20,
      plannedProviderCalls: 20,
      maxBillableCalls: 30,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: CONTRACT,
    };
    expect(() => ExperimentCostGovernor.fromSnapshot(govConfig, strippedSnapshot)).toThrow(
      /unresolvedLiabilityByTrialMicroUsd sum/,
    );

    const overlappingSnapshot = {
      ...result.costGovernorSnapshot,
      completedTrialIds: [...result.costGovernorSnapshot.completedTrialIds, result.trials[1].trialId],
    };
    expect(() => ExperimentCostGovernor.fromSnapshot(govConfig, overlappingSnapshot)).toThrow(
      /cannot be both completed and have unresolved liability/,
    );
  });

  it('rejects malformed deferred reconciliation envelope and preserves resumed pairs + prior receipt attempt metadata', async () => {
    const { stage1 } = loadAssets();
    const baseTransport = createDeterministicMockTransport(CONTRACT);
    let pair2ArmBCalls = 0;
    const partialThenMissingUsage: EvalTransportFn = async (req) => {
      if (req.brief.briefId === stage1.selectedBriefs[1].briefId && req.armId === 'arm_b_direct_model') {
        pair2ArmBCalls += 1;
        if (pair2ArmBCalls === 1) {
          return {
            ok: false,
            failureClass: 'RATE_LIMITED_429',
            retryable: true,
            acceptedByProvider: false,
            httpStatus: 429,
            message: 'transient 429 before missing usage on attempt 2',
            requestTimestampIso: '2026-11-23T12:00:00.000Z',
          };
        }
        const res = await baseTransport(req);
        if (res.ok) {
          return { ...res, promptTokens: null, completionTokens: null, cachedPromptTokens: undefined };
        }
        return res;
      }
      return baseTransport(req);
    };

    // First run completes pair 1 and halts on pair 2 Arm B missing usage (attempt 2)
    const run1 = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      authorization: buildSignedAuth(stage1.manifest, {
        experimentRunId: 'run-deferred-resume-001',
        authorizationNonce: 'nonce-deferred-resume-001',
      }),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: partialThenMissingUsage,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(run1.completedPairsCount).toBe(1);
    const pendingTrial = run1.trials.find((t) => t.status === 'COST_RECONCILIATION_REQUIRED')!;
    expect(pendingTrial).toBeDefined();

    // Simulate a resumed runResult whose `trials` array only has pair 2 while snapshot retains pair 1 completedTrialIds
    const resumedRunSubset = {
      ...run1,
      trials: run1.trials.filter((t) => t.briefId === stage1.selectedBriefs[1].briefId),
    };

    const payload: DeferredUsageReconciliationPayload = {
      domain: FOUNDER_RECONCILIATION_DOMAIN,
      manifestSha256: run1.manifestSha256,
      trialId: pendingTrial.trialId,
      outputSha256: pendingTrial.outputSha256!,
      promptTokens: 600,
      completionTokens: 400,
      reconciledAtIso: '2026-11-23T12:15:00.000Z',
      founderSignerKeyId: TEST_FOUNDER_KEYPAIR.trustAnchor.signerKeyId,
    };

    // Reject wrong signatureAlgorithm / unexpected extra field
    const badAlgoRecord = {
      payload,
      signatureAlgorithm: 'RSA-SHA256',
      signatureBase64: TEST_FOUNDER_KEYPAIR.signDomainPayload(FOUNDER_RECONCILIATION_DOMAIN, payload),
    } as unknown as DeferredUsageReconciliationRecord;
    expect(() =>
      reconcileDeferredTrialUsage({
        runResult: resumedRunSubset,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: CONTRACT,
        reconciliation: badAlgoRecord,
        trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      }),
    ).toThrow(/DEFERRED_RECONCILIATION_SIGNATURE_INVALID/);

    const validRecord: DeferredUsageReconciliationRecord = {
      payload,
      signatureAlgorithm: 'Ed25519',
      signatureBase64: TEST_FOUNDER_KEYPAIR.signDomainPayload(FOUNDER_RECONCILIATION_DOMAIN, payload),
    };

    const reconciled = reconcileDeferredTrialUsage({
      runResult: resumedRunSubset,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: CONTRACT,
      reconciliation: validRecord,
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
    });

    // Preserves pair 1 from previouslyCompletedTrialIds AND completes pair 2 => 2 total pairs!
    expect(reconciled.completedPairsCount).toBe(2);
    const deferredReceipt = reconciled.receipts.find(
      (r) => r.receiptId === `${pendingTrial.trialId}:deferred-reconciled`,
    );
    expect(deferredReceipt?.attemptNumber).toBe(2);
  });

  it('rejects reconcileDeferredUsage while another admission is active', () => {
    const gov = new ExperimentCostGovernor({
      plannedLogicalTrials: 2,
      plannedProviderCalls: 2,
      maxBillableCalls: 4,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: CONTRACT,
    });

    const adm1 = gov.admitCall({
      trialId: 'trial-1',
      attemptNumber: 1,
      modelId: CONTRACT.modelId,
      pricingVersion: CONTRACT.pricingVersion,
      promptTokensEstimate: 500,
      maxOutputTokens: 1200,
    });
    expect(adm1.admitted).toBe(true);

    expect(() =>
      gov.reconcileDeferredUsage({
        trialId: 'trial-1',
        promptTokens: 500,
        completionTokens: 400,
        trialSucceeded: true,
        authorizedBy: 'test-founder-ed25519-v1',
      }),
    ).toThrow(/DEFERRED_RECONCILIATION_ACTIVE_ADMISSION/);
  });
});
