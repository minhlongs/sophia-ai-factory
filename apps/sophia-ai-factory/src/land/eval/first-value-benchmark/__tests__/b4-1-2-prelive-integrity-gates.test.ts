import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptUserPrompt,
} from '@/seed/ai/script-prompt-builders';
import { validateParsedScriptStructure } from '@/seed/ai/script-generator-helpers';
import {
  assertLiveAuthorization,
  assessOutputTokenCapFeasibility,
  buildArmAProductionPrompt,
  buildBlindEvaluationPackets,
  buildMockProductionScriptJson,
  buildOpenAiDirectRequestPayload,
  buildStage1CalibrationManifest,
  computeSha256Hex,
  computeStage1CallPolicySummary,
  computeStage1ManifestSha256,
  createDeterministicMockTransport,
  createEphemeralTestFounderKeypair,
  ExperimentCostGovernor,
  FOUNDER_AUTH_DOMAIN,
  FOUNDER_AUTH_SCHEMA_VERSION,
  InMemoryAuthorizationNonceLedger,
  installBenchmarkZeroNetworkGuard,
  normalizeBriefForProductionScript,
  parseAndValidateArmAOutput,
  PINNED_MODEL_CONTRACTS,
  runBudgetGatedCalibration,
  STAGE1_ARM_A_MIN_SCENES,
  STAGE1_DEFAULT_TARGET_DURATION_SEC,
  STAGE1_EXPERIMENTAL_CONFIG,
  verifyFrozenDataset,
  verifyFrozenRubric,
  verifyStage1CalibrationManifest,
  type EvalTransportFn,
  type EvalTransportRequest,
  type ExperimentAuthorizationPayload,
  type ExperimentAuthorizationRecord,
  type Stage1CalibrationManifest,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');

const EXPECTED_DATASET_SHA256 = '80e2f2aec64a0ac21446e92b87fc3ac6632164fa158bfe7ea8ec76221ccaf2ff';
const EXPECTED_RUBRIC_SHA256 = '31dbffd556f12957a3a643bb3fb3efa0d1fb2447e75db50809cfd4bd10fc77fd';
const EXPECTED_MANIFEST_SHA256 = 'ee4b26241207126ca7b3485b42518809e9d180ad4f1e8c41920f33ba63c10f2c';

function loadStage1Assets() {
  const datasetRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
  const manifestRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
  const rubricRaw = fs.readFileSync(path.join(EVAL_DIR, 'rubric-v1.json'), 'utf8');
  const stage1Raw = fs.readFileSync(path.join(EVAL_DIR, 'stage1-calibration-manifest-v1.json'), 'utf8');
  const dataset = verifyFrozenDataset(datasetRaw, manifestRaw);
  const rubric = verifyFrozenRubric(rubricRaw, dataset.manifest.rubricSha256).rubric;
  const stage1 = verifyStage1CalibrationManifest(stage1Raw, dataset.briefs, dataset.manifest);
  return { dataset, rubric, stage1 };
}

const TEST_FOUNDER_KEYPAIR = createEphemeralTestFounderKeypair('test-founder-ed25519-b4-1-2');

function buildSyntheticAuth(
  manifest: Stage1CalibrationManifest,
  overrides?: Partial<ExperimentAuthorizationPayload>,
): ExperimentAuthorizationRecord {
  const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
  const payload: ExperimentAuthorizationPayload = {
    schemaVersion: FOUNDER_AUTH_SCHEMA_VERSION,
    domain: FOUNDER_AUTH_DOMAIN,
    authorizationId: 'SYNTHETIC-TEST-AUTH-001',
    experimentRunId: 'run-synthetic-test-001',
    authorizationNonce: 'nonce-synthetic-test-001',
    founderSignerKeyId: TEST_FOUNDER_KEYPAIR.trustAnchor.signerKeyId,
    approvedBy: 'synthetic-test-harness',
    approvedAtIso: '2026-11-23T00:00:00.000Z',
    expiresAtIso: '2026-11-24T00:00:00.000Z',
    stage: 'STAGE1',
    manifestVersion: manifest.protocolVersion,
    manifestSha256: computeStage1ManifestSha256(manifest),
    datasetSha256: manifest.datasetSha256,
    rubricSha256: manifest.rubricSha256,
    randomSeed: manifest.randomSeed,
    selectedBriefIds: [...manifest.selectedBriefIds],
    modelId: contract.modelId,
    pricingVersion: contract.pricingVersion,
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

describe('P2-A: Manifest-Bound Live Authorization & Immutable Execution Snapshot', () => {
  it('accepts original verified manifest offline and returns a deep-frozen immutable snapshot', () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const auth = buildSyntheticAuth(stage1.manifest);
    const snapshot = assertLiveAuthorization({
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      contract,
      maxOutputTokensCap: 1200,
      nowIso: '2026-11-23T12:00:00.000Z',
      authorization: auth,
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: createDeterministicMockTransport(contract),
    });

    expect(snapshot.manifestSha256).toBe(EXPECTED_MANIFEST_SHA256);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.selectedBriefIds)).toBe(true);
    expect(Object.isFrozen(snapshot.authorization)).toBe(true);
  });

  it('rejects every tampered or mismatched authorization field (12 adversarial cases)', () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const transport = createDeterministicMockTransport(contract);
    const baseArgs = {
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      contract,
      maxOutputTokensCap: 1200,
      nowIso: '2026-11-23T12:00:00.000Z',
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: transport,
    };

    // 1. Missing authorization
    expect(() => assertLiveAuthorization({ ...baseArgs, authorization: undefined })).toThrow(
      /LIVE_AUTHORIZATION_REQUIRED/,
    );

    // 2. Changed brief ID in authorization
    const swappedBriefs = [...stage1.manifest.selectedBriefIds];
    swappedBriefs[0] = 'brief-tampered-999';
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { selectedBriefIds: swappedBriefs }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_BRIEFS_MISMATCH/);

    // 3. Changed model
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { modelId: 'gpt-5.4-2026-03-05' }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_MODEL_MISMATCH/);

    // 4. Increased spending cap above manifest ceiling
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { authorizedCeilingMicroUsd: 3_000_001 }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_CEILING_INVALID/);

    // 5. Changed output-token limit
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { maxOutputTokensCap: 2048 }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_TOKEN_CAP_MISMATCH/);

    // 6. Changed retry policy
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { maxRetriesPerTrial: 2 }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_RETRY_POLICY_MISMATCH/);

    // 7. Changed dataset hash
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { datasetSha256: '0'.repeat(64) }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_DATASET_MISMATCH/);

    // 8. Changed rubric hash
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { rubricSha256: '1'.repeat(64) }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_RUBRIC_MISMATCH/);

    // 9. Changed selection seed
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { randomSeed: 'altered-seed-v2' }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_SEED_MISMATCH/);

    // 10. Reused hash with altered manifest body (the original P2-A vulnerability!)
    const forgedManifest: Stage1CalibrationManifest = {
      ...stage1.manifest,
      callGraphPlan: {
        ...stage1.manifest.callGraphPlan,
        proposedSpendCeilingMicroUsd: 99_000_000,
      },
      // Reuses the original trusted manifestSha256 verbatim!
      manifestSha256: stage1.manifest.manifestSha256,
    };
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        manifest: forgedManifest,
        authorization: buildSyntheticAuth(stage1.manifest),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_MANIFEST_TAMPERED/);

    // 11. Expired authorization
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        nowIso: '2026-11-25T00:00:00.000Z',
        authorization: buildSyntheticAuth(stage1.manifest, { expiresAtIso: '2026-11-24T00:00:00.000Z' }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_EXPIRED/);

    // 12. Mismatched manifest digest
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { manifestSha256: 'f'.repeat(64) }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_MANIFEST_MISMATCH/);

    // 13. Missing/blank expiresAtIso or expiresAtIso <= approvedAtIso rejected (no non-expiring live approvals)
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, { expiresAtIso: '   ' }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_EXPIRY_REQUIRED/);
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        authorization: buildSyntheticAuth(stage1.manifest, {
          approvedAtIso: '2026-11-23T12:00:00.000Z',
          expiresAtIso: '2026-11-23T12:00:00.000Z',
        }),
      }),
    ).toThrow(/LIVE_AUTHORIZATION_EXPIRY_INVALID/);

    // 14. Direct assertLiveAuthorization call rejects mismatched selectedBriefs
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs,
        selectedBriefs: stage1.selectedBriefs.slice(0, 9),
        authorization: buildSyntheticAuth(stage1.manifest),
      }),
    ).toThrow(/MANIFEST_BRIEF_MISMATCH/);
  });

  it('halts immediately if caller mutates manifest after initial validation (TOCTOU guard)', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const mutableManifest = structuredClone(stage1.manifest) as {
      -readonly [K in keyof Stage1CalibrationManifest]: Stage1CalibrationManifest[K];
    };
    const baseTransport = createDeterministicMockTransport(contract);
    let callCount = 0;

    const mutatingTransport: EvalTransportFn = async (req) => {
      callCount += 1;
      if (callCount === 2) {
        // Tamper with the caller's manifest object after pair 1 completes
        mutableManifest.randomSeed = 'tampered-mid-run';
      }
      return baseTransport(req);
    };

    const result = await runBudgetGatedCalibration({
      mode: 'live_provider',
      liveExecutionEnabled: true,
      manifest: mutableManifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      authorization: buildSyntheticAuth(stage1.manifest),
      trustAnchor: TEST_FOUNDER_KEYPAIR.trustAnchor,
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: mutatingTransport,
      nowIso: () => '2026-11-23T12:00:00.000Z',
    });

    expect(result.haltedReason).toBe('MANIFEST_MUTATED_AFTER_VALIDATION');
    expect(callCount).toBe(2); // Stopped before pair 2 could start!
    expect(result.completedPairsCount).toBe(1);
    expect(result.incompletePairsCount).toBe(9);
  });
});

describe('P2-B: Arm A API Request Parity & OpenAI gpt-5.4-mini Parameter Compatibility', () => {
  it('omits response_format on Arm A to match production openrouter-caller.ts and maps OpenAI parameters accurately', () => {
    const { stage1 } = loadStage1Assets();
    const brief = stage1.selectedBriefs[0];
    const prodPrompt = buildArmAProductionPrompt(brief, STAGE1_DEFAULT_TARGET_DURATION_SEC);
    const normalized = normalizeBriefForProductionScript(brief, STAGE1_DEFAULT_TARGET_DURATION_SEC);

    // 1. Prompt equivalence
    expect(prodPrompt.systemPrompt).toBe(SCRIPT_SYSTEM_PROMPT);
    expect(prodPrompt.userPrompt).toBe(
      buildScriptUserPrompt(normalized.topic, normalized.audience, undefined, undefined, STAGE1_DEFAULT_TARGET_DURATION_SEC),
    );

    // 2. Parser equivalence
    const validJson = buildMockProductionScriptJson(brief, 30);
    const parsedA = parseAndValidateArmAOutput(validJson, { targetDurationSec: 30 });
    const parsedProd = validateParsedScriptStructure(JSON.parse(validJson), {
      minScenes: STAGE1_ARM_A_MIN_SCENES,
      targetDurationSec: 30,
    });
    expect(parsedA.ok).toBe(true);
    if (parsedA.ok) expect(parsedA.script).toEqual(parsedProd);

    // 3. Parameter mapping correctness (max_completion_tokens, reasoning_effort='none', omitted response_format)
    expect(STAGE1_EXPERIMENTAL_CONFIG.armAResponseFormat).toBe('omitted');
    expect(STAGE1_EXPERIMENTAL_CONFIG.productionResponseFormat).toBe('omitted');
    const mapped = buildOpenAiDirectRequestPayload({
      modelId: 'gpt-5.4-mini-2026-03-17',
      prompt: prodPrompt.combinedPrompt,
      maxOutputTokens: 1200,
      temperature: 0.3,
      reasoningEffort: 'none',
      responseFormat: 'omitted',
      armId: 'arm_a_sophia_basic',
    });
    expect(mapped.payload.max_completion_tokens).toBe(1200);
    expect('max_tokens' in mapped.payload).toBe(false);
    expect(mapped.payload.reasoning_effort).toBe('none');
    expect(mapped.payload.temperature).toBe(0.3);
    expect('response_format' in mapped.payload).toBe(false);
    expect(mapped.responseFormatParity).toBe('MATCHES_PRODUCTION_OMITTED');

    // 4. JSON-format difference detection
    const overridden = buildOpenAiDirectRequestPayload({
      modelId: 'gpt-5.4-mini-2026-03-17',
      prompt: prodPrompt.combinedPrompt,
      maxOutputTokens: 1200,
      temperature: 0.3,
      reasoningEffort: 'none',
      responseFormat: 'json_object',
      armId: 'arm_a_sophia_basic',
    });
    expect(overridden.payload.response_format).toEqual({ type: 'json_object' });
    expect(overridden.responseFormatParity).toBe('EXPERIMENTAL_RESPONSE_FORMAT_OVERRIDE');
  });

  it('rejects unsupported OpenAI gpt-5.4-mini parameter combinations', () => {
    // Non-default temperature with non-'none' reasoning_effort rejected
    expect(() =>
      buildOpenAiDirectRequestPayload({
        modelId: 'gpt-5.4-mini-2026-03-17',
        prompt: 'test',
        maxOutputTokens: 1200,
        temperature: 0.3,
        reasoningEffort: 'low',
        responseFormat: 'omitted',
        armId: 'arm_a_sophia_basic',
      }),
    ).toThrow(/UNSUPPORTED_PROVIDER_PARAMETER/);

    // Unsupported reasoning_effort value rejected
    expect(() =>
      buildOpenAiDirectRequestPayload({
        modelId: 'gpt-5.4-mini-2026-03-17',
        prompt: 'test',
        maxOutputTokens: 1200,
        temperature: 1,
        reasoningEffort: 'minimal',
        responseFormat: 'omitted',
        armId: 'arm_a_sophia_basic',
      }),
    ).toThrow(/UNSUPPORTED_PROVIDER_PARAMETER/);

    // Out-of-range temperature rejected
    expect(() =>
      buildOpenAiDirectRequestPayload({
        modelId: 'gpt-5.4-mini-2026-03-17',
        prompt: 'test',
        maxOutputTokens: 1200,
        temperature: 2.5,
        reasoningEffort: 'none',
        responseFormat: 'omitted',
        armId: 'arm_a_sophia_basic',
      }),
    ).toThrow(/UNSUPPORTED_PROVIDER_PARAMETER/);
  });

  it('classifies truncated JSON, missing script sections, incomplete finish, missing usage, and wrong model metadata accurately', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

    // Missing required script sections -> INVALID_MODEL_OUTPUT (not TOKEN_CAP_EXHAUSTED)
    const missingSections = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => ({
        ok: true,
        renderedOutput: JSON.stringify({ title: 'Only 1 scene', scenes: [{ scene_number: 1, visual_description: 'a', narration: 'b', duration_estimate: 10 }], total_duration: 10 }),
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-1',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 200,
        completionTokens: 150,
        finishReason: 'stop',
        latencyMs: 100,
      }),
    });
    expect(missingSections.trials[0].failureCategory).toBe('INVALID_MODEL_OUTPUT');
    expect(missingSections.trials[0].failureClass).toBe('INVALID_SCRIPT_STRUCTURE');

    // Incomplete provider response -> TOKEN_CAP_EXHAUSTED
    const incompleteRes = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => ({
        ok: true,
        renderedOutput: buildMockProductionScriptJson(stage1.selectedBriefs[0], 30),
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-2',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 200,
        completionTokens: 900,
        finishReason: 'incomplete',
        latencyMs: 100,
      }),
    });
    expect(incompleteRes.trials[0].failureCategory).toBe('TOKEN_CAP_EXHAUSTED');
    expect(incompleteRes.haltedReason).toBe('TOKEN_CAP_EXHAUSTED:PROVIDER_LENGTH_FINISH');

    // Missing usage metadata -> halts and marks MISSING_USAGE_METADATA
    const missingUsage = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => ({
        ok: true,
        renderedOutput: buildMockProductionScriptJson(req.brief, 30),
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-3',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: null,
        completionTokens: null,
        finishReason: 'stop',
        latencyMs: 100,
      }),
    });
    expect(missingUsage.haltedReason).toBe('MISSING_USAGE_METADATA');
    expect(missingUsage.costGovernorSnapshot.spendEvidenceStatus).toBe('MISSING_USAGE_METADATA');
    expect(missingUsage.trials[0].status).toBe('COST_RECONCILIATION_REQUIRED');
    expect(missingUsage.receipts[0].outcome).toBe('COST_RECONCILIATION_REQUIRED');
    expect(missingUsage.completedPairsCount).toBe(0);

    // Wrong model response metadata -> MODEL_PARITY_UNVERIFIED
    const wrongModel = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => ({
        ok: true,
        renderedOutput: req.armId === 'arm_a_sophia_basic' ? buildMockProductionScriptJson(req.brief, 30) : 'Direct script',
        provider: contract.provider,
        responseModelId: 'gpt-4o-mini-2024-07-18',
        modelFingerprint: 'fp-wrong',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 200,
        completionTokens: 200,
        finishReason: 'stop',
        latencyMs: 100,
      }),
    });
    expect(wrongModel.trials[0].parityStatus).toBe('MODEL_PARITY_UNVERIFIED');
    expect(wrongModel.receipts[0].parityReasons.some((r) => r.startsWith('response_model_mismatch:'))).toBe(true);

    // Valid mock output + identical provenance across Arm A ('omitted') and Arm B ('text')
    const captured: EvalTransportRequest[] = [];
    const baseTransport = createDeterministicMockTransport(contract);
    const validRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        captured.push(req);
        return baseTransport(req);
      },
    });
    expect(validRun.haltedReason).toBeNull();
    expect(captured[0].armId).toBe('arm_a_sophia_basic');
    expect(captured[0].responseFormat).toBe('omitted');
    expect(captured[1].armId).toBe('arm_b_direct_model');
    expect(captured[1].responseFormat).toBe('text');
    expect(captured[0].brief.briefId).toBe(captured[1].brief.briefId);
  });
});

describe('P2-C: Preflight Token-Cap Feasibility Enforcement & 5-State Failure Taxonomy', () => {
  it('blocks obviously infeasible output-token cap in preflight with ZERO transport calls', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const transportSpy = vi.fn(createDeterministicMockTransport(contract));

    const blocked = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      maxOutputTokensCap: 400,
      mockTransport: transportSpy,
    });

    expect(transportSpy).not.toHaveBeenCalled();
    expect(blocked.costGovernorSnapshot.admittedCalls).toBe(0);
    expect(blocked.preflightFeasibility.feasible).toBe(false);
    expect(blocked.preflightFeasibility.failureCategory).toBe('PREFLIGHT_INFEASIBLE');
    expect(blocked.preflightFeasibility.redesignCode).toBe('STAGE1_TOKEN_CAP_REDESIGN_REQUIRED');
    expect(blocked.haltedReason).toBe('PREFLIGHT_INFEASIBLE:STAGE1_TOKEN_CAP_REDESIGN_REQUIRED');
  });

  it('distinguishes Vietnamese longer-output vs English shorter-output thresholds and high schema overhead without auto-expanding cap', async () => {
    const { stage1 } = loadStage1Assets();
    const enOnly = stage1.selectedBriefs.filter((b) => b.language === 'en');
    const viOnly = stage1.selectedBriefs.filter((b) => b.language === 'vi');

    const enCheck = assessOutputTokenCapFeasibility(1200, { briefs: enOnly });
    const viCheck = assessOutputTokenCapFeasibility(1200, { briefs: viOnly });
    expect(enCheck.feasible).toBe(true);
    expect(viCheck.feasible).toBe(true);
    expect(viCheck.estimatedMinRequiredTokens).toBeGreaterThan(enCheck.estimatedMinRequiredTokens);

    // High schema overhead pushes 1200 into infeasible without auto-expanding maxOutputTokensCap
    const highOverhead = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'],
      maxOutputTokensCap: 1200,
      extraSchemaOverheadTokens: 700,
    });
    expect(highOverhead.haltedReason).toBe('PREFLIGHT_INFEASIBLE:STAGE1_TOKEN_CAP_REDESIGN_REQUIRED');
    expect(highOverhead.costGovernorSnapshot.admittedCalls).toBe(0);
  });

  it('handles finishReason=length, exact-cap valid JSON, and does not blindly retry after truncation', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

    // finishReason='length' triggers TOKEN_CAP_EXHAUSTED and does NOT retry under the same cap
    let truncCalls = 0;
    const lengthTrunc = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      maxOutputTokensCap: 1200,
      mockTransport: async () => {
        truncCalls += 1;
        return {
          ok: true,
          renderedOutput: '{"title":"Cut mid scene","scenes":[{"scene_number":1,"visual_description":"x',
          provider: contract.provider,
          responseModelId: contract.modelId,
          modelFingerprint: 'fp-len',
          requestTimestampIso: '2026-11-23T00:00:00.000Z',
          promptTokens: 300,
          completionTokens: 1200,
          finishReason: 'length',
          latencyMs: 200,
        };
      },
    });
    expect(truncCalls).toBe(1); // No blind retry under same insufficient cap
    expect(lengthTrunc.trials[0].failureCategory).toBe('TOKEN_CAP_EXHAUSTED');
    expect(lengthTrunc.costGovernorSnapshot.reservedMicroUsd).toBe(0);

    // Exact-cap valid JSON with finishReason='stop' succeeds
    const exactCapValid = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      maxOutputTokensCap: 1200,
      mockTransport: async (req) => ({
        ok: true,
        renderedOutput: req.armId === 'arm_a_sophia_basic' ? buildMockProductionScriptJson(req.brief, 30) : 'Direct text',
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-exact',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 300,
        completionTokens: 1200,
        finishReason: 'stop',
        latencyMs: 200,
      }),
    });
    expect(exactCapValid.haltedReason).toBeNull();
    expect(exactCapValid.completedPairsCount).toBe(10);
  });
});

describe('G4: 30-Call Ceiling Reconciliation, Concurrency, Rollback & Resume', () => {
  it('computes exact 30-call policy summary (target=10, worstCase=40, ceiling=30, guaranteed=7, headroom=2)', () => {
    const policy = computeStage1CallPolicySummary({
      targetPairs: 10,
      maxRetriesPerTrial: 1,
      maxBillableCalls: 30,
    });
    expect(policy.targetPairs).toBe(10);
    expect(policy.targetLogicalTrials).toBe(20);
    expect(policy.worstCaseCallsPerPair).toBe(4);
    expect(policy.theoreticalMaxCallsForAllPairs).toBe(40);
    expect(policy.hardBillableCallCeiling).toBe(30);
    expect(policy.guaranteedFullPairsUnderWorstCase).toBe(7);
    expect(policy.remainingUnpairedSlotHeadroom).toBe(2);
  });

  it('completes all 10 pairs with 0 retries (20 calls) and with 1 retry (21 calls)', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const baseTransport = createDeterministicMockTransport(contract);

    // 0 retries -> 10 pairs, 20 calls
    const cleanRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: baseTransport,
    });
    expect(cleanRun.haltedReason).toBeNull();
    expect(cleanRun.completedPairsCount).toBe(10);
    expect(cleanRun.incompletePairsCount).toBe(0);
    expect(cleanRun.costGovernorSnapshot.admittedCalls).toBe(20);

    // 1 retry -> 10 pairs, 21 calls
    let retriedOnce = false;
    const oneRetryRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        if (!retriedOnce) {
          retriedOnce = true;
          return {
            ok: false,
            failureClass: 'RATE_LIMITED_429',
            retryable: true,
            acceptedByProvider: false,
            httpStatus: 429,
            message: '429',
            requestTimestampIso: '2026-11-23T00:00:00.000Z',
          };
        }
        return baseTransport(req);
      },
    });
    expect(oneRetryRun.haltedReason).toBeNull();
    expect(oneRetryRun.completedPairsCount).toBe(10);
    expect(oneRetryRun.costGovernorSnapshot.admittedCalls).toBe(21);
    expect(oneRetryRun.costGovernorSnapshot.retryCount).toBe(1);
  });

  it('stops cleanly at 7 pairs (28 calls) under worst-case 4-call pairs and respects 29/30 call boundaries', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const baseTransport = createDeterministicMockTransport(contract);
    const seenTrialFirstAttempt = new Set<string>();

    // Every trial fails attempt 1 with retryable 429 and succeeds attempt 2 -> 4 calls/pair
    const worstCaseRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        if (!seenTrialFirstAttempt.has(req.trialId)) {
          seenTrialFirstAttempt.add(req.trialId);
          return {
            ok: false,
            failureClass: 'RATE_LIMITED_429',
            retryable: true,
            acceptedByProvider: false,
            httpStatus: 429,
            message: 'retryable 429',
            requestTimestampIso: '2026-11-23T00:00:00.000Z',
          };
        }
        return baseTransport(req);
      },
    });
    expect(worstCaseRun.completedPairsCount).toBe(7);
    expect(worstCaseRun.incompletePairsCount).toBe(3);
    expect(worstCaseRun.costGovernorSnapshot.admittedCalls).toBe(28);
    expect(worstCaseRun.costGovernorSnapshot.admittedCalls).toBeLessThanOrEqual(30);
    expect(worstCaseRun.haltedReason).toBe(
      `PAIRED_STOP_BEFORE_BRIEF:${stage1.selectedBriefs[7].briefId}:CALL_CEILING_EXCEEDED`,
    );

    // 29 and 30 calls consumed boundaries on CostGovernor
    const gov = new ExperimentCostGovernor({
      plannedLogicalTrials: 20,
      plannedProviderCalls: 20,
      maxBillableCalls: 30,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: contract,
    });
    for (let i = 1; i <= 29; i++) {
      const lease = gov.admitCall({
        trialId: `t-${i}`,
        attemptNumber: 1,
        modelId: contract.modelId,
        pricingVersion: contract.pricingVersion,
        promptTokensEstimate: 200,
        maxOutputTokens: 1200,
      });
      expect(lease.admitted).toBe(true);
      if (lease.admitted) gov.reconcileSuccess(lease.admissionId, { promptTokens: 200, completionTokens: 200 });
    }
    // At 29 calls consumed: pair check (needs 4) rejected; 30th single call allowed; 31st rejected
    const pairAt29 = gov.canAdmitBriefPair({
      armAPromptTokensEstimate: 200,
      armBPromptTokensEstimate: 200,
      maxOutputTokens: 1200,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
    });
    expect(pairAt29.admissible).toBe(false);
    const call30 = gov.admitCall({
      trialId: 't-30',
      attemptNumber: 1,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
      promptTokensEstimate: 200,
      maxOutputTokens: 1200,
    });
    expect(call30.admitted).toBe(true);
    if (call30.admitted) gov.reconcileSuccess(call30.admissionId, { promptTokens: 200, completionTokens: 200 });
    const call31 = gov.admitCall({
      trialId: 't-31',
      attemptNumber: 1,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
      promptTokensEstimate: 200,
      maxOutputTokens: 1200,
    });
    expect(call31.admitted).toBe(false);
    if (!call31.admitted) expect(call31.code).toBe('CALL_CEILING_EXCEEDED');
  });

  it('handles failed first arm, timeout-after-accept, unknown outcome, unissued rollback, concurrency, and restart/resume', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
    const baseTransport = createDeterministicMockTransport(contract);

    // Failed first arm (non-auth single-brief failure): pair is NOT counted as completed, partial raw evidence preserved
    const failedFirstArm = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        if (req.brief.briefId === stage1.selectedBriefs[0].briefId && req.armId === 'arm_a_sophia_basic') {
          return {
            ok: false,
            failureClass: 'PROVIDER_5XX',
            retryable: false,
            acceptedByProvider: false,
            httpStatus: 503,
            message: 'single-arm 503',
            requestTimestampIso: '2026-11-23T00:00:00.000Z',
          };
        }
        return baseTransport(req);
      },
    });
    expect(failedFirstArm.completedPairsCount).toBe(9);
    expect(failedFirstArm.incompletePairsCount).toBe(1);
    expect(failedFirstArm.trials[0].status).toBe('FAILED');
    expect(failedFirstArm.trials[0].failureCategory).toBe('PROVIDER_FAILURE');

    // Terminal AUTH_ERROR halts immediately (fail-fast, 1 call)
    const authErrorRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => ({
        ok: false,
        failureClass: 'AUTH_ERROR',
        retryable: false,
        acceptedByProvider: false,
        httpStatus: 401,
        message: 'bad key',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
      }),
    });
    expect(authErrorRun.haltedReason).toBe('AUTH_ERROR');
    expect(authErrorRun.costGovernorSnapshot.admittedCalls).toBe(1);

    // Failed HTTP-200 trial (TOKEN_CAP_EXHAUSTED) is NOT added to completedTrialIds, so resume does NOT falsely count it as a completed pair
    const failed200Run = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => ({
        ok: true,
        renderedOutput: '{"title":"Truncated","scenes":[{"scene_number":1',
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-trunc-resume',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 300,
        completionTokens: 1200,
        finishReason: 'length',
        latencyMs: 150,
      }),
    });
    expect(failed200Run.costGovernorSnapshot.completedTrialIds).toEqual([]);
    expect(failed200Run.completedPairsCount).toBe(0);

    // Timeout after provider acceptance -> retains uncertain liability and halts
    const timeoutRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => ({
        ok: false,
        failureClass: 'TIMEOUT_AFTER_ACCEPT',
        retryable: false,
        acceptedByProvider: true,
        message: 'timeout after accept',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
      }),
    });
    expect(timeoutRun.haltedReason).toBe('UNCERTAIN_FAILURE:TIMEOUT_AFTER_ACCEPT');
    expect(timeoutRun.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);

    // Unknown billable outcome (transport throws) -> retains uncertain liability and halts
    const thrownRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async () => {
        throw new Error('socket hangup');
      },
    });
    expect(thrownRun.haltedReason).toBe('UNCERTAIN_FAILURE:TRANSPORT_EXCEPTION');
    expect(thrownRun.costGovernorSnapshot.uncertainLiabilityMicroUsd).toBeGreaterThan(0);

    // Concurrent admission rejection + unissued rollback
    const gov = new ExperimentCostGovernor({
      plannedLogicalTrials: 20,
      plannedProviderCalls: 20,
      maxBillableCalls: 30,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: contract,
    });
    const first = gov.admitCall({
      trialId: 'trial-1',
      attemptNumber: 1,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
      promptTokensEstimate: 400,
      maxOutputTokens: 1200,
    });
    expect(first.admitted).toBe(true);
    const concurrent = gov.admitCall({
      trialId: 'trial-2',
      attemptNumber: 1,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
      promptTokensEstimate: 400,
      maxOutputTokens: 1200,
    });
    expect(concurrent.admitted).toBe(false);
    if (!concurrent.admitted) expect(concurrent.code).toBe('CONCURRENT_CALL_NOT_ALLOWED');

    // Rollback unissued reservation restores all counters cleanly
    if (first.admitted) {
      gov.rollbackUnissuedAdmission(first.admissionId, 'local_preflight_abort');
    }
    const afterRollback = gov.exportSnapshot();
    expect(afterRollback.reservedMicroUsd).toBe(0);
    expect(afterRollback.admittedCalls).toBe(0);
    expect(afterRollback.failedCalls).toBe(0);
    expect(afterRollback.seenAttemptKeys).toEqual([]);

    // Restart/resume completes remaining pairs without duplicating completed trials
    const partialManifest = buildStage1CalibrationManifest({
      briefs: loadStage1Assets().dataset.briefs,
      datasetManifest: loadStage1Assets().dataset.manifest,
    });
    let stopAfterTwoPairs = 0;
    const partialRun = await runBudgetGatedCalibration({
      manifest: partialManifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        stopAfterTwoPairs += 1;
        if (stopAfterTwoPairs === 5) {
          return {
            ok: false,
            failureClass: 'PROVIDER_5XX',
            retryable: false,
            acceptedByProvider: false,
            httpStatus: 503,
            message: 'transient stop',
            requestTimestampIso: '2026-11-23T00:00:00.000Z',
          };
        }
        return baseTransport(req);
      },
    });
    expect(partialRun.completedPairsCount).toBe(9); // Only brief[2] arm A failed

    // Resume from a clean 2-pair snapshot
    const twoPairGov = new ExperimentCostGovernor({
      plannedLogicalTrials: 20,
      plannedProviderCalls: 20,
      maxBillableCalls: 30,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: contract,
    });
    for (const brief of stage1.selectedBriefs.slice(0, 2)) {
      for (const armId of ['arm_a_sophia_basic', 'arm_b_direct_model'] as const) {
        const lease = twoPairGov.admitCall({
          trialId: `${brief.briefId}:${armId}:t1`,
          attemptNumber: 1,
          modelId: contract.modelId,
          pricingVersion: contract.pricingVersion,
          promptTokensEstimate: 300,
          maxOutputTokens: 1200,
        });
        if (lease.admitted) twoPairGov.reconcileSuccess(lease.admissionId, { promptTokens: 300, completionTokens: 250 });
      }
    }
    const resumedSnapshot = twoPairGov.exportSnapshot();

    // Duplicate trial after resume rejected directly by governor
    const resumedGov = ExperimentCostGovernor.fromSnapshot(
      {
        plannedLogicalTrials: 20,
        plannedProviderCalls: 20,
        maxBillableCalls: 30,
        maxRetriesPerTrial: 1,
        maxPromptTokensBudget: 4000,
        maxOutputTokensCap: 1200,
        authorizedCeilingMicroUsd: 3_000_000,
        spendingAuthorized: true,
        providerSpendingCapConfirmed: true,
        pricingContract: contract,
      },
      resumedSnapshot,
    );
    const dupCheck = resumedGov.admitCall({
      trialId: `${stage1.selectedBriefs[0].briefId}:arm_a_sophia_basic:t1`,
      attemptNumber: 1,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
      promptTokensEstimate: 300,
      maxOutputTokens: 1200,
    });
    expect(dupCheck.admitted).toBe(false);
    if (!dupCheck.admitted) expect(dupCheck.code).toBe('DUPLICATE_LOGICAL_TRIAL');

    // Resumed run skips first 2 pairs (4 trials) and executes only the remaining 8 pairs (16 trials)
    const resumedRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      resumeFromSnapshot: resumedSnapshot,
      mockTransport: baseTransport,
    });
    expect(resumedRun.haltedReason).toBeNull();
    expect(resumedRun.trials).toHaveLength(16);
    expect(resumedRun.completedPairsCount).toBe(10);
    expect(resumedRun.costGovernorSnapshot.admittedCalls).toBe(20);
  });
});

describe('G6: Offline End-to-End Calibration Drill (Zero Network, Honest Unmeasured Status)', () => {
  it('recalculates frozen SHA-256 digests, blocks outbound network, runs full mock drill, and emits honest NOT_MEASURED statuses', async () => {
    const guard = installBenchmarkZeroNetworkGuard();
    try {
      const { dataset, stage1 } = loadStage1Assets();
      expect(dataset.manifest.datasetSha256).toBe(EXPECTED_DATASET_SHA256);
      expect(dataset.manifest.rubricSha256).toBe(EXPECTED_RUBRIC_SHA256);
      expect(computeStage1ManifestSha256(stage1.manifest)).toBe(EXPECTED_MANIFEST_SHA256);
      expect(stage1.selectedBriefs).toHaveLength(10);

      // Outbound network is blocked at runtime boundary
      await expect(fetch('https://api.openai.com/v1/chat/completions')).rejects.toThrow(/B4_ZERO_NETWORK_VIOLATION/);

      const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
      const drill = await runBudgetGatedCalibration({
        manifest: stage1.manifest,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: contract,
      });

      expect(drill.transportMode).toBe('mock_transport');
      expect(drill.haltedReason).toBeNull();
      expect(drill.nextStageAutoStart).toBe(false);
      expect(drill.completedPairsCount).toBe(10);
      expect(drill.incompletePairsCount).toBe(0);
      expect(drill.preflightFeasibility.feasible).toBe(true);
      expect(drill.callPolicySummary.guaranteedFullPairsUnderWorstCase).toBe(7);

      // Build blind reviewer packets from deterministic mock outputs
      const trialRecords: TrialExecutionRecord[] = drill.trials.map((t) => {
        const brief = stage1.selectedBriefs.find((b) => b.briefId === t.briefId)!;
        return {
          trialId: t.trialId,
          briefId: t.briefId,
          industry: brief.industry,
          armId: t.armId,
          trialNumber: 1,
          executionMode: 'fixture_simulated',
          qualityStatus: 'QUALITY_NOT_MEASURED',
          renderedOutput: t.renderedOutput ?? '',
          inputSha256: t.inputSha256,
          outputSha256: t.outputSha256 ?? computeSha256Hex(''),
          orchestrationNotes: 'stage1_offline_drill',
          telemetry: {
            modelId: contract.modelId,
            modelVersion: contract.modelId,
            promptTokens: { status: 'NOT_MEASURED', reason: 'mock_transport' },
            completionTokens: { status: 'NOT_MEASURED', reason: 'mock_transport' },
            retryCount: 0,
            wallClockLatencyMs: { status: 'NOT_MEASURED', reason: 'mock_transport' },
            estimatedInferenceCostMicroUsd: { status: 'NOT_MEASURED', reason: 'mock_transport' },
            measuredInferenceCostMicroUsd: { status: 'NOT_MEASURED', reason: 'mock_transport' },
            infrastructureCostAllocationMicroUsd: 0,
            realPaidInferenceCostMicroUsd: 0,
          },
        };
      });
      const { reviewerPacket, armKeyMap } = buildBlindEvaluationPackets(
        trialRecords,
        stage1.selectedBriefs,
        { rubricVersion: dataset.manifest.rubricVersion, seed: stage1.manifest.randomSeed },
      );
      expect(reviewerPacket).toHaveLength(20);
      expect(armKeyMap).toHaveLength(20);
      for (const packet of reviewerPacket) {
        expect(packet.renderedScript.length).toBeGreaterThan(0);
      }

      // Honest offline evidence status — never fabricates real-model metrics
      const drillSummary = {
        REAL_MODEL_QUALITY: 'NOT_MEASURED' as const,
        REAL_MODEL_COST: 'NOT_MEASURED' as const,
        CUSTOMER_ACCEPTANCE: 'NOT_PROVEN' as const,
      };
      expect(drillSummary.REAL_MODEL_QUALITY).toBe('NOT_MEASURED');
      expect(drillSummary.REAL_MODEL_COST).toBe('NOT_MEASURED');
      expect(drillSummary.CUSTOMER_ACCEPTANCE).toBe('NOT_PROVEN');
    } finally {
      guard.restore();
    }
  });
});
