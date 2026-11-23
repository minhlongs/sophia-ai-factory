/**
 * Disabled-by-default Live Evaluation Adapter for B4.1 Stage 1 Calibration.
 * - Default transport is deterministic local mock (zero network calls, zero secret loading).
 * - Explicit live mode is disabled by default and requires operator intent, verified Stage 1 manifest,
 *   an exact Founder authorization record, and an explicitly injected transport.
 * - Never exposes an HTTP route, never reads production BYOK secrets, never auto-starts Stage 2.
 *
 * @module land/eval/first-value-benchmark/live-eval-adapter
 */

import {
  STAGE1_ARM_A_MIN_SCENES,
  STAGE1_DEFAULT_TARGET_DURATION_SEC,
  STAGE1_EXPERIMENTAL_CONFIG,
  buildArmAProductionPrompt,
  buildMockProductionScriptJson,
  parseAndValidateArmAOutput,
} from './arm-a-production-parity';
import { buildDirectModelPrompt } from './arm-specs';
import type { Stage1CalibrationManifest } from './calibration-manifest';
import {
  ExperimentCostGovernor,
  type CostGovernorSnapshot,
  type AdmissionRejectionCode,
} from './cost-governor';
import { computeSha256Hex } from './dataset-loader';
import {
  verifyModelVersionParity,
  type ModelParityAssessment,
  type PinnedModelPricingContract,
} from './model-contract';
import { BENCHMARK_ARMS, type BenchmarkArmId, type EvaluationBrief } from './types';

export const LIVE_ADAPTER_ENABLED_BY_DEFAULT = false as const;

export interface ExperimentAuthorizationRecord {
  readonly authorizationId: string;
  readonly approvedBy: string;
  readonly approvedAtIso: string;
  readonly manifestSha256: string;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly authorizedCeilingMicroUsd: number;
  readonly maxBillableCalls: number;
  readonly providerSpendingCapConfirmed: boolean;
}

export interface EvalTransportRequest {
  readonly trialId: string;
  readonly armId: BenchmarkArmId;
  readonly brief: EvaluationBrief;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly modelId: string;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  readonly responseFormat: 'json_object' | 'text';
}

export interface EvalTransportResponse {
  readonly ok: true;
  readonly renderedOutput: string;
  readonly provider: string;
  readonly responseModelId: string | null;
  readonly modelFingerprint: string | null;
  readonly requestTimestampIso: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens?: number;
  readonly observedChargedMicroUsd?: number | null;
  readonly latencyMs: number;
}

export interface EvalTransportFailure {
  readonly ok: false;
  readonly failureClass: 'RATE_LIMITED_429' | 'TIMEOUT_AFTER_ACCEPT' | 'PROVIDER_5XX' | 'AUTH_ERROR' | 'SCHEMA_INVALID';
  readonly retryable: boolean;
  readonly acceptedByProvider: boolean;
  readonly httpStatus?: number;
  readonly message: string;
  readonly requestTimestampIso: string;
}

export type EvalTransportResult = EvalTransportResponse | EvalTransportFailure;
export type EvalTransportFn = (req: EvalTransportRequest) => Promise<EvalTransportResult>;

export interface CallUsageReceipt {
  readonly receiptId: string;
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly attemptNumber: number;
  readonly transportMode: 'mock_transport' | 'live_provider';
  readonly provider: string;
  readonly requestedModelId: string;
  readonly responseModelId: string | null;
  readonly modelFingerprint: string | null;
  readonly requestTimestampIso: string;
  readonly parityStatus: ModelParityAssessment['status'];
  readonly parityReasons: readonly string[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly reservedMicroUsd: number;
  readonly observedCostMicroUsd: number | null;
  readonly outcome: 'SUCCESS' | 'FAILED_RETRYABLE' | 'FAILED_TERMINAL' | 'ADMISSION_REJECTED';
  readonly failureClass?: string;
}

export interface AdapterTrialEvidence {
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly inputSha256: string;
  readonly outputSha256: string | null;
  readonly renderedOutput: string | null;
  readonly status: 'COMPLETED' | 'FAILED' | 'BLOCKED_BY_GOVERNOR';
  readonly failureClass?: string;
  readonly rejectionCode?: AdmissionRejectionCode;
  readonly parityStatus: ModelParityAssessment['status'];
}

export interface CalibrationRunResult {
  readonly transportMode: 'mock_transport' | 'live_provider';
  readonly manifestSha256: string;
  readonly nextStageAutoStart: false;
  readonly haltedReason: string | null;
  readonly trials: readonly AdapterTrialEvidence[];
  readonly receipts: readonly CallUsageReceipt[];
  readonly costGovernorSnapshot: CostGovernorSnapshot;
}

export function createDeterministicMockTransport(contract: PinnedModelPricingContract): EvalTransportFn {
  return async (req: EvalTransportRequest): Promise<EvalTransportResponse> => {
    const output =
      req.armId === 'arm_a_sophia_basic'
        ? buildMockProductionScriptJson(req.brief, STAGE1_DEFAULT_TARGET_DURATION_SEC)
        : [
            `Title: ${req.brief.productOrService} (${req.brief.intendedPlatform})`,
            `Target Duration: ${STAGE1_DEFAULT_TARGET_DURATION_SEC}s`,
            `Scene 1 (8s) | Visual: Opening hook for ${req.brief.targetAudience} | Narration: ${req.brief.campaignObjective}`,
            `Scene 2 (14s) | Visual: Product showcase (${req.brief.brandVoice}) | Narration: ${req.brief.expectedDeliverable}`,
            `Scene 3 (8s) | Visual: Closing CTA card | Narration: ${req.brief.requiredCta}`,
          ].join('\n');
    return {
      ok: true,
      renderedOutput: output,
      provider: contract.provider,
      responseModelId: contract.modelId,
      modelFingerprint: `mock-fp-${contract.modelId}`,
      requestTimestampIso: '2026-11-23T00:00:00.000Z',
      promptTokens: Math.max(120, Math.ceil(req.prompt.length / 4)),
      completionTokens: Math.max(80, Math.ceil(output.length / 4)),
      cachedPromptTokens: 0,
      latencyMs: 250,
    };
  };
}

function assertSelectedBriefsMatchManifest(
  selectedBriefs: readonly EvaluationBrief[],
  manifest: Stage1CalibrationManifest,
): void {
  if (selectedBriefs.length !== manifest.selectedBriefIds.length) {
    throw new Error(
      `MANIFEST_BRIEF_MISMATCH: expected ${manifest.selectedBriefIds.length} briefs from manifest, received ${selectedBriefs.length}`,
    );
  }
  for (let i = 0; i < manifest.selectedBriefIds.length; i++) {
    if (selectedBriefs[i].briefId !== manifest.selectedBriefIds[i]) {
      throw new Error(
        `MANIFEST_BRIEF_MISMATCH: brief at index ${i} is "${selectedBriefs[i].briefId}", expected "${manifest.selectedBriefIds[i]}"`,
      );
    }
  }
}

function assertPositiveIntegerInRange(value: number, max: number, errorCode: string, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error(`${errorCode}: ${fieldName} must be in 1..${max}`);
  }
}

function assertLiveAuthorization(args: {
  readonly liveExecutionEnabled: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly contract: PinnedModelPricingContract;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly liveTransport?: EvalTransportFn;
}): ExperimentAuthorizationRecord {
  if (!args.liveExecutionEnabled) {
    throw new Error('LIVE_EXECUTION_DISABLED: live mode is disabled by default and requires explicit operator opt-in');
  }
  if (!args.authorization) {
    throw new Error('LIVE_AUTHORIZATION_REQUIRED: missing Founder ExperimentAuthorizationRecord');
  }
  const auth = args.authorization;
  if (!auth.authorizationId.trim() || !auth.approvedBy.trim() || !auth.approvedAtIso.trim()) {
    throw new Error('LIVE_AUTHORIZATION_INVALID: authorizationId, approvedBy, and approvedAtIso are required');
  }
  assertPositiveIntegerInRange(
    auth.authorizedCeilingMicroUsd,
    args.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    'LIVE_AUTHORIZATION_CEILING_INVALID',
    'authorizedCeilingMicroUsd',
  );
  assertPositiveIntegerInRange(
    auth.maxBillableCalls,
    args.manifest.callGraphPlan.runMaxBillableCallsCeiling,
    'LIVE_AUTHORIZATION_CALL_CEILING_INVALID',
    'maxBillableCalls',
  );
  if (auth.manifestSha256 !== args.manifest.manifestSha256) {
    throw new Error('LIVE_AUTHORIZATION_MANIFEST_MISMATCH: authorization does not match frozen Stage 1 manifest');
  }
  if (auth.modelId !== args.contract.modelId || auth.pricingVersion !== args.contract.pricingVersion) {
    throw new Error('LIVE_AUTHORIZATION_MODEL_MISMATCH: authorization model/pricing does not match pinned contract');
  }
  if (!auth.providerSpendingCapConfirmed) {
    throw new Error('LIVE_AUTHORIZATION_NO_PROVIDER_CAP: provider-side spending cap must be confirmed');
  }
  if (!args.liveTransport) {
    throw new Error('LIVE_TRANSPORT_NOT_CONFIGURED: no live provider transport injected (real network calls disabled offline)');
  }
  return auth;
}

function estimatePromptTokens(prompt: string): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(prompt, 'utf8') / 2));
}

interface ResolvedArmPrompt {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly responseFormat: 'json_object' | 'text';
}

function buildPromptForArm(
  armId: BenchmarkArmId,
  brief: EvaluationBrief,
  targetDurationSec: number,
): ResolvedArmPrompt {
  if (armId === 'arm_b_direct_model') {
    const directPrompt = buildDirectModelPrompt(brief);
    return {
      prompt: directPrompt,
      userPrompt: directPrompt,
      responseFormat: 'text',
    };
  }
  const prod = buildArmAProductionPrompt(brief, targetDurationSec);
  return {
    prompt: prod.combinedPrompt,
    systemPrompt: prod.systemPrompt,
    userPrompt: prod.userPrompt,
    responseFormat: 'json_object',
  };
}

function resolveExecutionPlan(args: {
  readonly mode: 'mock_transport' | 'live_provider';
  readonly liveExecutionEnabled: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly pricingContract: PinnedModelPricingContract;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly mockTransport?: EvalTransportFn;
  readonly liveTransport?: EvalTransportFn;
}): {
  readonly transport: EvalTransportFn;
  readonly ceilingMicroUsd: number;
  readonly maxBillableCalls: number;
  readonly providerCapConfirmed: boolean;
} {
  if (args.mode === 'live_provider') {
    const auth = assertLiveAuthorization({
      liveExecutionEnabled: args.liveExecutionEnabled,
      manifest: args.manifest,
      contract: args.pricingContract,
      authorization: args.authorization,
      liveTransport: args.liveTransport,
    });
    return {
      transport: args.liveTransport as EvalTransportFn,
      ceilingMicroUsd: auth.authorizedCeilingMicroUsd,
      maxBillableCalls: auth.maxBillableCalls,
      providerCapConfirmed: auth.providerSpendingCapConfirmed,
    };
  }
  return {
    transport: args.mockTransport ?? createDeterministicMockTransport(args.pricingContract),
    ceilingMicroUsd: args.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    maxBillableCalls: args.manifest.callGraphPlan.runMaxBillableCallsCeiling,
    providerCapConfirmed: true,
  };
}

export async function runBudgetGatedCalibration(args: {
  readonly mode?: 'mock_transport' | 'live_provider';
  readonly liveExecutionEnabled?: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly pricingContract: PinnedModelPricingContract;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly mockTransport?: EvalTransportFn;
  readonly liveTransport?: EvalTransportFn;
  readonly maxPromptTokensBudget?: number;
  readonly maxOutputTokensCap?: number;
  readonly targetDurationSec?: number;
  readonly temperature?: number;
  readonly nowIso?: () => string;
}): Promise<CalibrationRunResult> {
  assertSelectedBriefsMatchManifest(args.selectedBriefs, args.manifest);
  const mode = args.mode ?? 'mock_transport';
  const liveExecutionEnabled = args.liveExecutionEnabled ?? LIVE_ADAPTER_ENABLED_BY_DEFAULT;
  const defaultClock = mode === 'live_provider' ? () => new Date().toISOString() : () => '2026-11-23T00:00:00.000Z';
  const nowIso = args.nowIso ?? defaultClock;

  const plan = resolveExecutionPlan({
    mode,
    liveExecutionEnabled,
    manifest: args.manifest,
    pricingContract: args.pricingContract,
    authorization: args.authorization,
    mockTransport: args.mockTransport,
    liveTransport: args.liveTransport,
  });

  const maxOutputTokensCap = args.maxOutputTokensCap ?? STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap;
  const maxPromptTokensBudget = args.maxPromptTokensBudget ?? 4000;
  const targetDurationSec = args.targetDurationSec ?? STAGE1_DEFAULT_TARGET_DURATION_SEC;
  const temperature = args.temperature ?? STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature;
  const maxRetries = args.manifest.callGraphPlan.maxRetriesPerTrial;

  const governor = new ExperimentCostGovernor({
    plannedLogicalTrials: args.selectedBriefs.length * BENCHMARK_ARMS.length,
    plannedProviderCalls: args.selectedBriefs.length * BENCHMARK_ARMS.length,
    maxBillableCalls: plan.maxBillableCalls,
    maxRetriesPerTrial: maxRetries,
    maxPromptTokensBudget,
    maxOutputTokensCap,
    authorizedCeilingMicroUsd: plan.ceilingMicroUsd,
    spendingAuthorized: true,
    providerSpendingCapConfirmed: plan.providerCapConfirmed,
    pricingContract: args.pricingContract,
  });

  const receipts: CallUsageReceipt[] = [];
  const trials: AdapterTrialEvidence[] = [];
  let haltedReason: string | null = null;

  for (const brief of args.selectedBriefs) {
    if (haltedReason) break;
    haltedReason = await executeBriefPair({
      brief,
      mode,
      maxRetries,
      maxOutputTokensCap,
      targetDurationSec,
      temperature,
      contract: args.pricingContract,
      governor,
      transport: plan.transport,
      receipts,
      trials,
      nowIso,
    });
  }

  return {
    transportMode: mode,
    manifestSha256: args.manifest.manifestSha256,
    nextStageAutoStart: false,
    haltedReason,
    trials,
    receipts,
    costGovernorSnapshot: governor.exportSnapshot(),
  };
}

interface BriefPairExecutionContext {
  readonly brief: EvaluationBrief;
  readonly mode: 'mock_transport' | 'live_provider';
  readonly maxRetries: number;
  readonly maxOutputTokensCap: number;
  readonly targetDurationSec: number;
  readonly temperature: number;
  readonly contract: PinnedModelPricingContract;
  readonly governor: ExperimentCostGovernor;
  readonly transport: EvalTransportFn;
  readonly receipts: CallUsageReceipt[];
  readonly trials: AdapterTrialEvidence[];
  readonly nowIso: () => string;
}

async function executeBriefPair(ctx: BriefPairExecutionContext): Promise<string | null> {
  const armAPrompt = buildPromptForArm('arm_a_sophia_basic', ctx.brief, ctx.targetDurationSec);
  const armBPrompt = buildPromptForArm('arm_b_direct_model', ctx.brief, ctx.targetDurationSec);
  const pairCheck = ctx.governor.canAdmitBriefPair({
    armAPromptTokensEstimate: estimatePromptTokens(armAPrompt.prompt),
    armBPromptTokensEstimate: estimatePromptTokens(armBPrompt.prompt),
    maxOutputTokens: ctx.maxOutputTokensCap,
    modelId: ctx.contract.modelId,
    pricingVersion: ctx.contract.pricingVersion,
  });
  if (!pairCheck.admissible) {
    return `PAIRED_STOP_BEFORE_BRIEF:${ctx.brief.briefId}:${pairCheck.code}`;
  }

  const pairPrompts: Readonly<Record<BenchmarkArmId, ResolvedArmPrompt>> = {
    arm_a_sophia_basic: armAPrompt,
    arm_b_direct_model: armBPrompt,
  };

  for (const armId of BENCHMARK_ARMS) {
    const trialId = `${ctx.brief.briefId}:${armId}:t1`;
    const resolvedPrompt = pairPrompts[armId];
    const inputSha256 = computeSha256Hex(
      JSON.stringify({ briefId: ctx.brief.briefId, armId, prompt: resolvedPrompt.prompt }),
    );
    const outcome = await executeSingleTrial({
      trialId,
      brief: ctx.brief,
      armId,
      resolvedPrompt,
      inputSha256,
      mode: ctx.mode,
      maxRetries: ctx.maxRetries,
      maxOutputTokensCap: ctx.maxOutputTokensCap,
      targetDurationSec: ctx.targetDurationSec,
      temperature: ctx.temperature,
      contract: ctx.contract,
      governor: ctx.governor,
      transport: ctx.transport,
      receipts: ctx.receipts,
      nowIso: ctx.nowIso,
    });
    ctx.trials.push(outcome.evidence);
    if (outcome.haltReason) return outcome.haltReason;
  }

  return null;
}

interface TrialAttemptContext {
  readonly trialId: string;
  readonly brief: EvaluationBrief;
  readonly armId: BenchmarkArmId;
  readonly resolvedPrompt: ResolvedArmPrompt;
  readonly inputSha256: string;
  readonly mode: 'mock_transport' | 'live_provider';
  readonly maxRetries: number;
  readonly maxOutputTokensCap: number;
  readonly targetDurationSec: number;
  readonly temperature: number;
  readonly contract: PinnedModelPricingContract;
  readonly governor: ExperimentCostGovernor;
  readonly transport: EvalTransportFn;
  readonly receipts: CallUsageReceipt[];
  readonly nowIso: () => string;
}

function recordAdmissionRejection(
  ctx: TrialAttemptContext,
  attempt: number,
  code: AdmissionRejectionCode,
): { readonly evidence: AdapterTrialEvidence; readonly haltReason: string } {
  ctx.receipts.push({
    receiptId: `${ctx.trialId}:attempt-${attempt}:rejected`,
    trialId: ctx.trialId,
    briefId: ctx.brief.briefId,
    armId: ctx.armId,
    attemptNumber: attempt,
    transportMode: ctx.mode,
    provider: ctx.contract.provider,
    requestedModelId: ctx.contract.modelId,
    responseModelId: null,
    modelFingerprint: null,
    requestTimestampIso: ctx.nowIso(),
    parityStatus: 'MODEL_PARITY_UNVERIFIED',
    parityReasons: ['admission_rejected'],
    promptTokens: null,
    completionTokens: null,
    reservedMicroUsd: 0,
    observedCostMicroUsd: null,
    outcome: 'ADMISSION_REJECTED',
    failureClass: code,
  });
  return {
    evidence: {
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      inputSha256: ctx.inputSha256,
      outputSha256: null,
      renderedOutput: null,
      status: 'BLOCKED_BY_GOVERNOR',
      rejectionCode: code,
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
    },
    haltReason: `GOVERNOR_REJECTED:${code}`,
  };
}

function buildObservedReceipt(args: {
  readonly ctx: TrialAttemptContext;
  readonly attempt: number;
  readonly admissionId: string;
  readonly reservedMicroUsd: number;
  readonly res: EvalTransportResponse;
  readonly parity: ModelParityAssessment;
  readonly observedCostMicroUsd: number | null;
  readonly outcome: 'SUCCESS' | 'FAILED_TERMINAL';
  readonly failureClass?: string;
}): CallUsageReceipt {
  return {
    receiptId: args.admissionId,
    trialId: args.ctx.trialId,
    briefId: args.ctx.brief.briefId,
    armId: args.ctx.armId,
    attemptNumber: args.attempt,
    transportMode: args.ctx.mode,
    provider: args.res.provider,
    requestedModelId: args.ctx.contract.modelId,
    responseModelId: args.res.responseModelId,
    modelFingerprint: args.res.modelFingerprint,
    requestTimestampIso: args.res.requestTimestampIso,
    parityStatus: args.parity.status,
    parityReasons: args.parity.reasons,
    promptTokens: args.res.promptTokens,
    completionTokens: args.res.completionTokens,
    reservedMicroUsd: args.reservedMicroUsd,
    observedCostMicroUsd: args.observedCostMicroUsd,
    outcome: args.outcome,
    ...(args.failureClass ? { failureClass: args.failureClass } : {}),
  };
}

function validateArmAResponseOutput(
  ctx: TrialAttemptContext,
  res: EvalTransportResponse,
):
  | { readonly ok: true; readonly renderedOutput: string }
  | { readonly ok: false; readonly failureClass: string; readonly haltReason: string | null } {
  if (ctx.armId !== 'arm_a_sophia_basic') {
    return { ok: true, renderedOutput: res.renderedOutput };
  }
  const validated = parseAndValidateArmAOutput(res.renderedOutput, {
    minScenes: STAGE1_ARM_A_MIN_SCENES,
    targetDurationSec: ctx.targetDurationSec,
  });
  if (validated.ok) {
    return { ok: true, renderedOutput: validated.renderedOutput };
  }
  const hitTokenCap =
    validated.errorCode === 'INVALID_JSON' &&
    res.completionTokens !== null &&
    res.completionTokens >= ctx.maxOutputTokensCap;
  return {
    ok: false,
    failureClass: hitTokenCap ? 'BUDGET_CAP_INFEASIBLE' : validated.errorCode,
    haltReason: hitTokenCap ? 'BUDGET_CAP_INFEASIBLE:MAX_OUTPUT_TOKENS_TRUNCATED' : null,
  };
}

function recordTransportSuccess(
  ctx: TrialAttemptContext,
  attempt: number,
  admissionId: string,
  reservedMicroUsd: number,
  res: EvalTransportResponse,
): { readonly evidence: AdapterTrialEvidence; readonly haltReason: string | null } {
  const parity = verifyModelVersionParity(ctx.contract, {
    provider: res.provider,
    requestedModelId: ctx.contract.modelId,
    responseModelId: res.responseModelId,
    modelFingerprint: res.modelFingerprint,
    requestTimestampIso: res.requestTimestampIso,
  });
  const reconciled = ctx.governor.reconcileSuccess(admissionId, {
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    cachedPromptTokens: res.cachedPromptTokens,
    observedChargedMicroUsd: res.observedChargedMicroUsd,
  });
  const missingUsageHalt = reconciled.observedCostMicroUsd === null ? 'MISSING_USAGE_METADATA' : null;
  const outputCheck = validateArmAResponseOutput(ctx, res);

  if (!outputCheck.ok) {
    ctx.receipts.push(
      buildObservedReceipt({
        ctx,
        attempt,
        admissionId,
        reservedMicroUsd,
        res,
        parity,
        observedCostMicroUsd: reconciled.observedCostMicroUsd,
        outcome: 'FAILED_TERMINAL',
        failureClass: outputCheck.failureClass,
      }),
    );
    return {
      evidence: {
        trialId: ctx.trialId,
        briefId: ctx.brief.briefId,
        armId: ctx.armId,
        inputSha256: ctx.inputSha256,
        outputSha256: null,
        renderedOutput: null,
        status: 'FAILED',
        failureClass: outputCheck.failureClass,
        parityStatus: parity.status,
      },
      haltReason: outputCheck.haltReason ?? missingUsageHalt,
    };
  }

  ctx.receipts.push(
    buildObservedReceipt({
      ctx,
      attempt,
      admissionId,
      reservedMicroUsd,
      res,
      parity,
      observedCostMicroUsd: reconciled.observedCostMicroUsd,
      outcome: 'SUCCESS',
    }),
  );
  return {
    evidence: {
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      inputSha256: ctx.inputSha256,
      outputSha256: computeSha256Hex(outputCheck.renderedOutput),
      renderedOutput: outputCheck.renderedOutput,
      status: 'COMPLETED',
      parityStatus: parity.status,
    },
    haltReason: missingUsageHalt,
  };
}

function recordTransportException(
  ctx: TrialAttemptContext,
  attempt: number,
  admissionId: string,
  reservedMicroUsd: number,
  err: unknown,
): { readonly evidence: AdapterTrialEvidence; readonly haltReason: string } {
  const message = err instanceof Error ? err.message : String(err);
  ctx.governor.reconcileFailure(admissionId, {
    acceptedByProvider: true,
    reason: `transport_exception:${message}`,
  });
  ctx.receipts.push({
    receiptId: admissionId,
    trialId: ctx.trialId,
    briefId: ctx.brief.briefId,
    armId: ctx.armId,
    attemptNumber: attempt,
    transportMode: ctx.mode,
    provider: ctx.contract.provider,
    requestedModelId: ctx.contract.modelId,
    responseModelId: null,
    modelFingerprint: null,
    requestTimestampIso: ctx.nowIso(),
    parityStatus: 'MODEL_PARITY_UNVERIFIED',
    parityReasons: ['call_failed:TRANSPORT_EXCEPTION'],
    promptTokens: null,
    completionTokens: null,
    reservedMicroUsd,
    observedCostMicroUsd: null,
    outcome: 'FAILED_TERMINAL',
    failureClass: 'TRANSPORT_EXCEPTION',
  });
  return {
    evidence: {
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      inputSha256: ctx.inputSha256,
      outputSha256: null,
      renderedOutput: null,
      status: 'FAILED',
      failureClass: 'TRANSPORT_EXCEPTION',
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
    },
    haltReason: 'UNCERTAIN_FAILURE:TRANSPORT_EXCEPTION',
  };
}

async function executeSingleTrial(
  ctx: TrialAttemptContext,
): Promise<{ readonly evidence: AdapterTrialEvidence; readonly haltReason: string | null }> {
  let lastFailureClass: string | undefined;

  for (let attempt = 1; attempt <= ctx.maxRetries + 1; attempt++) {
    const decision = ctx.governor.admitCall({
      trialId: ctx.trialId,
      attemptNumber: attempt,
      modelId: ctx.contract.modelId,
      pricingVersion: ctx.contract.pricingVersion,
      promptTokensEstimate: estimatePromptTokens(ctx.resolvedPrompt.prompt),
      maxOutputTokens: ctx.maxOutputTokensCap,
    });

    if (!decision.admitted) {
      return recordAdmissionRejection(ctx, attempt, decision.code);
    }

    let res: EvalTransportResult;
    try {
      res = await ctx.transport({
        trialId: ctx.trialId,
        armId: ctx.armId,
        brief: ctx.brief,
        prompt: ctx.resolvedPrompt.prompt,
        systemPrompt: ctx.resolvedPrompt.systemPrompt,
        userPrompt: ctx.resolvedPrompt.userPrompt,
        modelId: ctx.contract.modelId,
        maxOutputTokens: ctx.maxOutputTokensCap,
        temperature: ctx.temperature,
        responseFormat: ctx.resolvedPrompt.responseFormat,
      });
    } catch (err) {
      return recordTransportException(ctx, attempt, decision.admissionId, decision.reservedMicroUsd, err);
    }

    if (res.ok) {
      return recordTransportSuccess(ctx, attempt, decision.admissionId, decision.reservedMicroUsd, res);
    }

    lastFailureClass = res.failureClass;
    ctx.governor.reconcileFailure(decision.admissionId, {
      acceptedByProvider: res.acceptedByProvider,
      httpStatus: res.httpStatus,
      reason: res.message,
    });
    const canRetry = res.retryable && !res.acceptedByProvider && attempt <= ctx.maxRetries;
    ctx.receipts.push({
      receiptId: decision.admissionId,
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      attemptNumber: attempt,
      transportMode: ctx.mode,
      provider: ctx.contract.provider,
      requestedModelId: ctx.contract.modelId,
      responseModelId: null,
      modelFingerprint: null,
      requestTimestampIso: res.requestTimestampIso,
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
      parityReasons: [`call_failed:${res.failureClass}`],
      promptTokens: null,
      completionTokens: null,
      reservedMicroUsd: decision.reservedMicroUsd,
      observedCostMicroUsd: null,
      outcome: canRetry ? 'FAILED_RETRYABLE' : 'FAILED_TERMINAL',
      failureClass: res.failureClass,
    });
    if (!canRetry) {
      return {
        evidence: {
          trialId: ctx.trialId,
          briefId: ctx.brief.briefId,
          armId: ctx.armId,
          inputSha256: ctx.inputSha256,
          outputSha256: null,
          renderedOutput: null,
          status: 'FAILED',
          failureClass: res.failureClass,
          parityStatus: 'MODEL_PARITY_UNVERIFIED',
        },
        haltReason: res.acceptedByProvider ? `UNCERTAIN_FAILURE:${res.failureClass}` : null,
      };
    }
  }

  return {
    evidence: {
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      inputSha256: ctx.inputSha256,
      outputSha256: null,
      renderedOutput: null,
      status: 'FAILED',
      failureClass: lastFailureClass,
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
    },
    haltReason: null,
  };
}
