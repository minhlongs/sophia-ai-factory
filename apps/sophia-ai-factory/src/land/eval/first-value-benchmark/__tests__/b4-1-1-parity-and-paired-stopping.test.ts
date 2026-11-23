import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as scriptPromptBuilders from '@/seed/ai/script-prompt-builders';
import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptUserPrompt,
} from '@/seed/ai/script-prompt-builders';
import {
  InvalidScriptStructureError,
  validateParsedScriptStructure,
} from '@/seed/ai/script-generator-helpers';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import {
  assessOutputTokenCapFeasibility,
  buildArmAProductionPrompt,
  buildBlindEvaluationPackets,
  buildDirectModelPrompt,
  buildMockProductionScriptJson,
  classifyArmAProductionError,
  computeConservativeCallCostMicroUsd,
  computeSha256Hex,
  createDeterministicMockTransport,
  ExperimentCostGovernor,
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
  type EvalTransportRequest,
  type TrialExecutionRecord,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');

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

describe('B4.1.1 G2 Production Prompt/Parser Parity, G3 Fairness, G5 Paired Stopping, and G8 Runtime Containment', () => {
  it('G2.1-G2.2 & G2.7: matches production SCRIPT_SYSTEM_PROMPT and buildScriptUserPrompt byte-for-byte for EN and VI briefs', () => {
    const { stage1 } = loadStage1Assets();
    const enBrief = stage1.selectedBriefs.find((b) => b.language === 'en')!;
    const viBrief = stage1.selectedBriefs.find((b) => b.language === 'vi')!;

    for (const brief of [enBrief, viBrief]) {
      const armAPrompt = buildArmAProductionPrompt(brief, STAGE1_DEFAULT_TARGET_DURATION_SEC);
      const normalized = normalizeBriefForProductionScript(brief, STAGE1_DEFAULT_TARGET_DURATION_SEC);
      const expectedUserPrompt = buildScriptUserPrompt(
        normalized.topic,
        normalized.audience,
        undefined,
        undefined,
        STAGE1_DEFAULT_TARGET_DURATION_SEC,
      );

      expect(armAPrompt.systemPrompt).toBe(SCRIPT_SYSTEM_PROMPT);
      expect(armAPrompt.userPrompt).toBe(expectedUserPrompt);
      expect(armAPrompt.combinedPrompt).toBe(`System: ${SCRIPT_SYSTEM_PROMPT}\n\nUser: ${expectedUserPrompt}`);
    }

    const enPrompt = buildArmAProductionPrompt(enBrief);
    const viPrompt = buildArmAProductionPrompt(viBrief);
    expect(enPrompt.userPrompt).toContain('English');
    expect(viPrompt.userPrompt).toContain('Vietnamese');
    expect(enPrompt.userPrompt).not.toBe(viPrompt.userPrompt);
  });

  it('G2.3-G2.6: matches production JSON.parse + validateParsedScriptStructure(minScenes=3) on valid, malformed, missing-field, and unsafe outputs', () => {
    const { stage1 } = loadStage1Assets();
    const brief = stage1.selectedBriefs[0];
    const validJson = buildMockProductionScriptJson(brief, 30);

    // 3. Valid script parity
    const prodValid = validateParsedScriptStructure(JSON.parse(validJson), {
      minScenes: STAGE1_ARM_A_MIN_SCENES,
      targetDurationSec: 30,
    });
    const armAValid = parseAndValidateArmAOutput(validJson, { targetDurationSec: 30 });
    expect(armAValid.ok).toBe(true);
    if (armAValid.ok) {
      expect(armAValid.script).toEqual(prodValid);
    }

    // 4. Malformed JSON (including markdown code fences, which production strict JSON.parse rejects)
    for (const badJson of ['not json', '```json\n' + validJson + '\n```', '{"title": "cut off']) {
      expect(() => JSON.parse(badJson)).toThrow();
      const res = parseAndValidateArmAOutput(badJson, { targetDurationSec: 30 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errorCode).toBe('INVALID_JSON');
        expect(res.message).toBe('Invalid JSON from LLM');
      }
    }

    // 5. Missing-field rejection (missing title, fewer than 3 scenes, empty narration)
    const missingFieldCases = [
      { scenes: prodValid.scenes, total_duration: 30 },
      { title: 'Only 2 scenes', scenes: prodValid.scenes.slice(0, 2), total_duration: 30 },
      {
        title: 'Blank narration',
        scenes: prodValid.scenes.map((s, idx) => (idx === 0 ? { ...s, narration: '   ' } : s)),
        total_duration: 30,
      },
    ];
    for (const payload of missingFieldCases) {
      expect(() =>
        validateParsedScriptStructure(payload, { minScenes: 3, targetDurationSec: 30 }),
      ).toThrow(InvalidScriptStructureError);
      const res = parseAndValidateArmAOutput(JSON.stringify(payload), { targetDurationSec: 30 });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errorCode).toBe('INVALID_SCRIPT_STRUCTURE');
    }

    // 6. Unsafe / invalid structure handling (negative duration, non-integer scene_number, out-of-range total_duration, primitive root)
    const unsafeCases: unknown[] = [
      null,
      'plain string',
      { ...prodValid, total_duration: 90 }, // outside 15..45s for target 30s
      {
        ...prodValid,
        scenes: prodValid.scenes.map((s, idx) => (idx === 1 ? { ...s, scene_number: 0 } : s)),
      },
      {
        ...prodValid,
        scenes: prodValid.scenes.map((s, idx) => (idx === 2 ? { ...s, duration_estimate: -5 } : s)),
      },
    ];
    for (const payload of unsafeCases) {
      expect(() =>
        validateParsedScriptStructure(payload, { minScenes: 3, targetDurationSec: 30 }),
      ).toThrow(InvalidScriptStructureError);
      const res = parseAndValidateArmAOutput(JSON.stringify(payload), { targetDurationSec: 30 });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errorCode).toBe('INVALID_SCRIPT_STRUCTURE');
    }

    // Production error classification parity
    expect(classifyArmAProductionError(new InvalidScriptStructureError('bad'))).toBe('INVALID_SCRIPT_STRUCTURE');
    expect(classifyArmAProductionError(new Error('quota exceeded'))).toBe('PROVIDER_QUOTA_EXCEEDED');
    expect(classifyArmAProductionError(new Error('401 unauthorized'))).toBe('PROVIDER_INVALID_KEY');
    expect(classifyArmAProductionError(new ProviderQuotaExceededError('openrouter', 'quota'))).toBe(
      'PROVIDER_QUOTA_EXCEEDED',
    );
    expect(classifyArmAProductionError(new ProviderInvalidKeyError('openrouter', 'invalid key'))).toBe(
      'PROVIDER_INVALID_KEY',
    );
  });

  it('G2.10: detects production prompt drift and ensures zero prompt duplication in eval adapter', () => {
    const adapterSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/land/eval/first-value-benchmark/live-eval-adapter.ts'),
      'utf8',
    );
    const paritySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/land/eval/first-value-benchmark/arm-a-production-parity.ts'),
      'utf8',
    );
    const prodPromptSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/seed/ai/script-prompt-builders.ts'),
      'utf8',
    );

    // Zero hardcoded copies of SCRIPT_SYSTEM_PROMPT or stub '[SOPHIA_BASIC_WORKFLOW]' in eval harness
    expect(adapterSrc).not.toContain('[SOPHIA_BASIC_WORKFLOW]');
    expect(adapterSrc).not.toContain('expert video script writer');
    expect(paritySrc).not.toContain('expert video script writer');
    expect(paritySrc).toContain("from '@/seed/ai/script-prompt-builders'");
    expect(paritySrc).toContain("from '@/seed/ai/script-generator-helpers'");
    expect(prodPromptSrc).toContain(SCRIPT_SYSTEM_PROMPT);

    // SHA-256 fingerprint of production SCRIPT_SYSTEM_PROMPT matches Arm A systemPrompt exactly;
    // any edit to SCRIPT_SYSTEM_PROMPT immediately changes this digest and surfaces in parity tests.
    const { stage1 } = loadStage1Assets();
    const armAPrompt = buildArmAProductionPrompt(stage1.selectedBriefs[0]);
    expect(computeSha256Hex(armAPrompt.systemPrompt)).toBe(computeSha256Hex(SCRIPT_SYSTEM_PROMPT));

    // Mutating production buildScriptUserPrompt output is immediately reflected in Arm A prompt
    const spy = vi
      .spyOn(scriptPromptBuilders, 'buildScriptUserPrompt')
      .mockReturnValueOnce('PRODUCTION_PROMPT_DRIFT_SENTINEL');
    try {
      const drifted = buildArmAProductionPrompt(stage1.selectedBriefs[0]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(drifted.userPrompt).toBe('PRODUCTION_PROMPT_DRIFT_SENTINEL');
      expect(drifted.combinedPrompt).toContain('PRODUCTION_PROMPT_DRIFT_SENTINEL');
    } finally {
      spy.mockRestore();
    }
  });

  it('G2.8-G2.9 & G3: enforces retry semantics, parameter fairness, and classifies max_tokens truncation as BUDGET_CAP_INFEASIBLE', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

    // Token cap feasibility check
    expect(assessOutputTokenCapFeasibility(1200).feasible).toBe(true);
    expect(assessOutputTokenCapFeasibility(400)).toMatchObject({
      feasible: false,
      classification: 'INFEASIBLE_BUDGET_CAP',
    });
    expect(STAGE1_EXPERIMENTAL_CONFIG.variantClassification).toBe('BUDGET_BOUNDED_SOPHIA_BASIC_VARIANT');

    // Parameter fairness across Arm A and Arm B + retryable 429 retry behavior
    const seenRequests: EvalTransportRequest[] = [];
    const baseMock = createDeterministicMockTransport(contract);
    let retriedOnce = false;
    const run = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      mockTransport: async (req) => {
        seenRequests.push(req);
        if (req.trialId === `${stage1.selectedBriefs[0].briefId}:arm_a_sophia_basic:t1` && !retriedOnce) {
          retriedOnce = true;
          return {
            ok: false,
            failureClass: 'RATE_LIMITED_429',
            retryable: true,
            acceptedByProvider: false,
            httpStatus: 429,
            message: 'Simulated 429 rate limit',
            requestTimestampIso: '2026-11-23T00:00:00.000Z',
          };
        }
        return baseMock(req);
      },
    });
    expect(run.haltedReason).toBeNull();
    expect(run.trials).toHaveLength(20);
    expect(run.costGovernorSnapshot.retryCount).toBe(1);

    const armAReq = seenRequests.find((r) => r.armId === 'arm_a_sophia_basic')!;
    const armBReq = seenRequests.find((r) => r.armId === 'arm_b_direct_model')!;
    expect(armAReq.modelId).toBe(armBReq.modelId);
    expect(armAReq.maxOutputTokens).toBe(armBReq.maxOutputTokens);
    expect(armAReq.temperature).toBe(armBReq.temperature);
    expect(armAReq.systemPrompt).toBe(SCRIPT_SYSTEM_PROMPT);
    expect(armBReq.prompt).toBe(buildDirectModelPrompt(armBReq.brief));

    // Truncated JSON at maxOutputTokensCap classified as BUDGET_CAP_INFEASIBLE (never silently blamed on Sophia)
    const truncatedRun = await runBudgetGatedCalibration({
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
      maxOutputTokensCap: 1200,
      mockTransport: async (req) => ({
        ok: true,
        renderedOutput: '{"title":"Truncated","scenes":[{"scene_number":1',
        provider: contract.provider,
        responseModelId: contract.modelId,
        modelFingerprint: 'fp-trunc',
        requestTimestampIso: '2026-11-23T00:00:00.000Z',
        promptTokens: 300,
        completionTokens: 1200,
        latencyMs: 300,
      }),
    });
    expect(truncatedRun.haltedReason).toBe('BUDGET_CAP_INFEASIBLE:MAX_OUTPUT_TOKENS_TRUNCATED');
    expect(truncatedRun.trials[0].status).toBe('FAILED');
    expect(truncatedRun.trials[0].failureClass).toBe('BUDGET_CAP_INFEASIBLE');
    // Token spend was still reconciled despite invalid JSON
    expect(truncatedRun.costGovernorSnapshot.actualSpendMicroUsd).toBeGreaterThan(0);
    expect(truncatedRun.costGovernorSnapshot.reservedMicroUsd).toBe(0);
  });

  it('G5: enforces paired stopping rule before starting a brief pair when call or budget cap cannot cover both arms', async () => {
    const { stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

    // Call-cap boundary: 6 calls allows pair 1 (2 calls used, 4 remaining -> pair 2 needs 4 -> allowed),
    // whereas 5 calls allows pair 1 (2 calls used, 3 remaining -> pair 2 needs worst-case 4 -> MUST stop before pair 2!)
    const callCappedManifest = {
      ...stage1.manifest,
      callGraphPlan: {
        ...stage1.manifest.callGraphPlan,
        runMaxBillableCallsCeiling: 5,
      },
    };
    const callCappedRun = await runBudgetGatedCalibration({
      manifest: callCappedManifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
    });
    expect(callCappedRun.haltedReason).toBe(
      `PAIRED_STOP_BEFORE_BRIEF:${stage1.selectedBriefs[1].briefId}:CALL_CEILING_EXCEEDED`,
    );
    expect(callCappedRun.trials).toHaveLength(2);
    expect(callCappedRun.trials.map((t) => `${t.briefId}:${t.armId}`)).toEqual([
      `${stage1.selectedBriefs[0].briefId}:arm_a_sophia_basic`,
      `${stage1.selectedBriefs[0].briefId}:arm_b_direct_model`,
    ]);

    // Budget-cap boundary: set ceiling to cover worst-case of pair 1 + 1 single arm (not 2 full arms with retries)
    const armACost = computeConservativeCallCostMicroUsd(contract, 800, 1200);
    const pairWorstCase = armACost * 4;
    const budgetCappedManifest = {
      ...stage1.manifest,
      callGraphPlan: {
        ...stage1.manifest.callGraphPlan,
        proposedSpendCeilingMicroUsd: pairWorstCase + armACost,
      },
    };
    const budgetCappedRun = await runBudgetGatedCalibration({
      manifest: budgetCappedManifest,
      selectedBriefs: stage1.selectedBriefs,
      pricingContract: contract,
    });
    expect(budgetCappedRun.haltedReason).toMatch(/^PAIRED_STOP_BEFORE_BRIEF:.*:BUDGET_CEILING_EXCEEDED$/);
    // Every started brief must have BOTH Arm A and Arm B (zero orphaned single-arm briefs)
    const countByBrief = new Map<string, number>();
    for (const t of budgetCappedRun.trials) {
      countByBrief.set(t.briefId, (countByBrief.get(t.briefId) ?? 0) + 1);
    }
    expect(countByBrief.size).toBeGreaterThanOrEqual(1);
    for (const count of countByBrief.values()) {
      expect(count).toBe(2);
    }

    // Direct governor unit check on canAdmitBriefPair
    const gov = new ExperimentCostGovernor({
      plannedLogicalTrials: 4,
      plannedProviderCalls: 4,
      maxBillableCalls: 3,
      maxRetriesPerTrial: 1,
      maxPromptTokensBudget: 4000,
      maxOutputTokensCap: 1200,
      authorizedCeilingMicroUsd: 3_000_000,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: contract,
    });
    const check = gov.canAdmitBriefPair({
      armAPromptTokensEstimate: 500,
      armBPromptTokensEstimate: 300,
      maxOutputTokens: 1200,
      modelId: contract.modelId,
      pricingVersion: contract.pricingVersion,
    });
    expect(check.admissible).toBe(false);
    if (!check.admissible) {
      expect(check.code).toBe('CALL_CEILING_EXCEEDED');
      expect(check.requiredCalls).toBe(4);
    }
  });

  it('G8: enforces runtime-boundary zero-network containment (fetch + Node sockets) and full offline Stage 1 blind drill', async () => {
    const { dataset, stage1 } = loadStage1Assets();
    const contract = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

    const guard = installBenchmarkZeroNetworkGuard();
    try {
      await expect(fetch('https://api.openai.com/v1/chat/completions')).rejects.toThrow(
        /B4_ZERO_NETWORK_VIOLATION/,
      );
      expect(() => http.get('http://127.0.0.1:1/blocked')).toThrow(/B4_ZERO_NETWORK_VIOLATION/);
      expect(guard.blockedUrls.length).toBeGreaterThanOrEqual(2);

      // Full 10-brief / 20-trial offline Stage 1 drill
      const run = await runBudgetGatedCalibration({
        manifest: stage1.manifest,
        selectedBriefs: stage1.selectedBriefs,
        pricingContract: contract,
      });
      expect(run.haltedReason).toBeNull();
      expect(run.nextStageAutoStart).toBe(false);
      expect(run.trials).toHaveLength(20);
      expect(run.trials.every((t) => t.status === 'COMPLETED' && t.outputSha256 !== null)).toBe(true);

      // Convert completed mock drill into blind packets and verify zero cross-arm leakage
      const trialRecords: TrialExecutionRecord[] = run.trials.map((t) => {
        const brief = stage1.selectedBriefs.find((b) => b.briefId === t.briefId)!;
        return {
          trialId: t.trialId,
          briefId: t.briefId,
          industry: brief.industry,
          armId: t.armId,
          trialNumber: 1,
          executionMode: 'fixture_simulated',
          qualityStatus: 'QUALITY_NOT_MEASURED',
          renderedOutput: t.renderedOutput!,
          inputSha256: t.inputSha256,
          outputSha256: t.outputSha256!,
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
        { rubricVersion: dataset.manifest.rubricVersion, seed: 'stage1-drill-seed' },
      );
      expect(reviewerPacket).toHaveLength(20);
      expect(armKeyMap).toHaveLength(20);
      for (const item of reviewerPacket) {
        expect(item.renderedScript).not.toContain('arm_a_sophia_basic');
        expect(item.renderedScript).not.toContain('arm_b_direct_model');
        expect(item.renderedScript).not.toContain('SOPHIA_BASIC');
      }
    } finally {
      guard.restore();
    }
  });
});
