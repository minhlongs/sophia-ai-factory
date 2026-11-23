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
  assessOutputTokenCapFeasibility,
  buildArmAProductionPrompt,
  buildMockProductionScriptJson,
  buildOpenAiDirectRequestPayload,
  parseAndValidateArmAOutput,
  type EvalResponseFormatMode,
  type OpenAiReasoningEffort,
  type TokenCapFeasibilityAssessment,
} from './arm-a-production-parity';
import { buildDirectModelPrompt } from './arm-specs';
import {
  computeStage1ManifestSha256,
  type Stage1CalibrationManifest,
} from './calibration-manifest';
import {
  ExperimentCostGovernor,
  computeStage1CallPolicySummary,
  type AdmissionRejectionCode,
  type CostGovernorSnapshot,
  type Stage1CallPolicySummary,
} from './cost-governor';
import { computeSha256Hex } from './dataset-loader';
import {
  FOUNDER_AUTH_DOMAIN,
  FOUNDER_AUTH_SCHEMA_VERSION,
  FOUNDER_RECONCILIATION_DOMAIN,
  assertStrictAuthorizationEnvelope,
  assertStrictDeferredReconciliationEnvelope,
  verifyDetachedEd25519Signature,
  type AuthorizationNonceLedger,
  type DeferredUsageReconciliationPayload,
  type DeferredUsageReconciliationRecord,
  type ExperimentAuthorizationPayload,
  type ExperimentAuthorizationRecord,
  type FounderTrustAnchor,
} from './founder-authorization';
import {
  verifyModelVersionParity,
  type ModelParityAssessment,
  type PinnedModelPricingContract,
} from './model-contract';
import {
  countAuthoritativePairCompletions,
  evaluateTrialFinality,
  type AdapterTrialStatus,
  type CallReceiptOutcome,
} from './trial-finality';
import {
  BENCHMARK_ARMS,
  type BenchmarkArmId,
  type EvaluationBrief,
  type TrialExecutionRecord,
} from './types';

export {
  type AuthorizationNonceLedger,
  type ExperimentAuthorizationPayload,
  type ExperimentAuthorizationRecord,
  type FounderTrustAnchor,
} from './founder-authorization';

export const LIVE_ADAPTER_ENABLED_BY_DEFAULT = false as const;

export type TrialFailureCategory =
  | 'PREFLIGHT_INFEASIBLE'
  | 'TOKEN_CAP_EXHAUSTED'
  | 'INVALID_MODEL_OUTPUT'
  | 'PROVIDER_FAILURE'
  | 'BUDGET_EXHAUSTED';

export interface ImmutableExecutionSnapshot {
  readonly manifestSha256: string;
  readonly manifest: Stage1CalibrationManifest;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly contract: PinnedModelPricingContract;
  readonly authorization: ExperimentAuthorizationRecord | null;
  readonly authorizationDigestSha256: string | null;
  readonly experimentRunId: string | null;
  readonly ceilingMicroUsd: number;
  readonly maxBillableCalls: number;
  readonly maxOutputTokensCap: number;
  readonly maxRetriesPerTrial: number;
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly temperature: number;
  readonly providerProjectId: string | null;
  readonly permittedEnvironment: string | null;
  readonly providerCapConfirmed: boolean;
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
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly responseFormat: EvalResponseFormatMode;
}

export interface EvalTransportResponse {
  readonly ok: true;
  readonly renderedOutput: string;
  readonly provider: string;
  readonly responseId?: string | null;
  readonly responseModelId: string | null;
  readonly modelFingerprint: string | null;
  readonly requestTimestampIso: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly reasoningTokens?: number | null;
  readonly finishReason?: 'stop' | 'length' | 'content_filter' | 'incomplete' | string | null;
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
  readonly reasoningTokens?: number | null;
  readonly finishReason?: string | null;
  readonly reservedMicroUsd: number;
  readonly observedCostMicroUsd: number | null;
  readonly liabilityHeldMicroUsd: number;
  readonly outcome: CallReceiptOutcome;
  readonly failureClass?: string;
  readonly failureCategory?: TrialFailureCategory;
}

export interface AdapterTrialEvidence {
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly inputSha256: string;
  readonly outputSha256: string | null;
  readonly renderedOutput: string | null;
  readonly status: AdapterTrialStatus;
  readonly outputContractValid: boolean;
  readonly providerResponseId: string | null;
  readonly providerModelVersion: string | null;
  readonly observedCostMicroUsd: number | null;
  readonly trialRecord: TrialExecutionRecord | null;
  readonly failureClass?: string;
  readonly failureCategory?: TrialFailureCategory;
  readonly rejectionCode?: AdmissionRejectionCode;
  readonly parityStatus: ModelParityAssessment['status'];
}

export interface CalibrationRunResult {
  readonly transportMode: 'mock_transport' | 'live_provider';
  readonly manifestSha256: string;
  readonly nextStageAutoStart: false;
  readonly haltedReason: string | null;
  readonly preflightFeasibility: TokenCapFeasibilityAssessment;
  readonly callPolicySummary: Stage1CallPolicySummary;
  readonly completedPairsCount: number;
  readonly incompletePairsCount: number;
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
      reasoningTokens: 0,
      finishReason: 'stop',
      cachedPromptTokens: 0,
      latencyMs: 250,
    };
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const prop of Object.values(value as Record<string, unknown>)) {
    if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return value;
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

function assertExactStringListMatch(
  actual: readonly string[],
  expected: readonly string[],
  errorCode: string,
): void {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(`${errorCode}: selectedBriefIds length mismatch (${actual?.length ?? 0} !== ${expected.length})`);
  }
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${errorCode}: selectedBriefIds[${i}] "${actual[i]}" !== "${expected[i]}"`);
    }
  }
}

function assertAuthorizationTimeWindow(
  approvedAtIso: string,
  expiresAtIso: string,
  nowIso: string,
): void {
  if (!expiresAtIso?.trim()) {
    throw new Error('LIVE_AUTHORIZATION_EXPIRY_REQUIRED: expiresAtIso is required for live execution');
  }
  const approvedMs = Date.parse(approvedAtIso);
  const expiresMs = Date.parse(expiresAtIso);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(approvedMs) || !Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) {
    throw new Error('LIVE_AUTHORIZATION_EXPIRY_INVALID: invalid ISO timestamp in approvedAtIso or expiresAtIso');
  }
  if (approvedMs > nowMs) {
    throw new Error(
      `LIVE_AUTHORIZATION_FUTURE_DATED: approvedAtIso (${approvedAtIso}) is in the future relative to now (${nowIso})`,
    );
  }
  if (expiresMs <= approvedMs) {
    throw new Error(
      `LIVE_AUTHORIZATION_EXPIRY_INVALID: expiresAtIso (${expiresAtIso}) must be after approvedAtIso (${approvedAtIso})`,
    );
  }
  if (expiresMs <= nowMs) {
    throw new Error(`LIVE_AUTHORIZATION_EXPIRED: authorization expired at ${expiresAtIso} (now=${nowIso})`);
  }
}

function assertAuthorizationFieldsMatchManifest(
  payload: ExperimentAuthorizationPayload,
  manifest: Stage1CalibrationManifest,
  maxOutputTokensCap: number,
  expectedReasoningEffort: OpenAiReasoningEffort,
  expectedTemperature: number,
): void {
  if (payload.manifestVersion !== manifest.protocolVersion) {
    throw new Error(
      `LIVE_AUTHORIZATION_MANIFEST_VERSION_MISMATCH: authorization manifestVersion=${payload.manifestVersion} !== manifest ${manifest.protocolVersion}`,
    );
  }
  if (payload.datasetSha256 !== manifest.datasetSha256) {
    throw new Error('LIVE_AUTHORIZATION_DATASET_MISMATCH: authorization datasetSha256 does not match manifest');
  }
  if (payload.rubricSha256 !== manifest.rubricSha256) {
    throw new Error('LIVE_AUTHORIZATION_RUBRIC_MISMATCH: authorization rubricSha256 does not match manifest');
  }
  if (payload.randomSeed !== manifest.randomSeed) {
    throw new Error('LIVE_AUTHORIZATION_SEED_MISMATCH: authorization randomSeed does not match manifest');
  }
  assertExactStringListMatch(payload.selectedBriefIds, manifest.selectedBriefIds, 'LIVE_AUTHORIZATION_BRIEFS_MISMATCH');
  if (payload.maxRetriesPerTrial !== manifest.callGraphPlan.maxRetriesPerTrial) {
    throw new Error(
      `LIVE_AUTHORIZATION_RETRY_POLICY_MISMATCH: authorization maxRetriesPerTrial=${payload.maxRetriesPerTrial} !== manifest ${manifest.callGraphPlan.maxRetriesPerTrial}`,
    );
  }
  if (!Number.isSafeInteger(payload.maxOutputTokensCap) || payload.maxOutputTokensCap !== maxOutputTokensCap) {
    throw new Error(
      `LIVE_AUTHORIZATION_TOKEN_CAP_MISMATCH: authorization maxOutputTokensCap=${payload.maxOutputTokensCap} !== requested ${maxOutputTokensCap}`,
    );
  }
  if (payload.reasoningEffort !== expectedReasoningEffort) {
    throw new Error(
      `LIVE_AUTHORIZATION_REASONING_MISMATCH: authorization reasoningEffort=${payload.reasoningEffort} !== requested ${expectedReasoningEffort}`,
    );
  }
  if (payload.temperature !== expectedTemperature) {
    throw new Error(
      `LIVE_AUTHORIZATION_TEMPERATURE_MISMATCH: authorization temperature=${String(payload.temperature)} !== requested ${expectedTemperature}`,
    );
  }
}

export function assertLiveAuthorization(args: {
  readonly liveExecutionEnabled: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly contract: PinnedModelPricingContract;
  readonly maxOutputTokensCap: number;
  readonly nowIso: string;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly trustAnchor?: FounderTrustAnchor | null;
  readonly nonceLedger?: AuthorizationNonceLedger;
  readonly expectedRunId?: string;
  readonly expectedStage?: string;
  readonly expectedReasoningEffort?: OpenAiReasoningEffort;
  readonly expectedTemperature?: number;
  readonly expectedPermittedEnvironment?: string;
  readonly expectedProviderProjectId?: string;
  readonly isExplicitResume?: boolean;
  readonly liveTransport?: EvalTransportFn;
}): ImmutableExecutionSnapshot {
  if (!args.liveExecutionEnabled) {
    throw new Error('LIVE_EXECUTION_DISABLED: live mode is disabled by default and requires explicit operator opt-in');
  }
  if (!args.authorization) {
    throw new Error('LIVE_AUTHORIZATION_REQUIRED: missing signed Founder ExperimentAuthorizationRecord');
  }

  // 1. Validate strict canonical authorization schema (rejects unsigned or injected keys like publicKey)
  assertStrictAuthorizationEnvelope(args.authorization);
  const auth = args.authorization;
  const { payload } = auth;

  if (payload.schemaVersion !== FOUNDER_AUTH_SCHEMA_VERSION) {
    throw new Error(
      `AUTHORIZATION_SCHEMA_INVALID: unsupported schemaVersion "${String(payload.schemaVersion)}"`,
    );
  }
  if (payload.domain !== FOUNDER_AUTH_DOMAIN) {
    throw new Error(`AUTHORIZATION_DOMAIN_INVALID: unsupported domain "${String(payload.domain)}"`);
  }

  // 2–4. Resolve operator-controlled trust anchor, verify Ed25519 detached signature and signer key ID
  const verifiedSig = verifyDetachedEd25519Signature({
    domain: FOUNDER_AUTH_DOMAIN,
    payload,
    signatureBase64: auth.signatureBase64,
    trustAnchor: args.trustAnchor,
    expectedSignerKeyId: payload.founderSignerKeyId,
  });

  if (
    !payload.authorizationId?.trim() ||
    !payload.experimentRunId?.trim() ||
    !payload.authorizationNonce?.trim() ||
    !payload.approvedBy?.trim() ||
    !payload.approvedAtIso?.trim() ||
    !payload.permittedEnvironment?.trim() ||
    !payload.providerProjectId?.trim()
  ) {
    throw new Error(
      'LIVE_AUTHORIZATION_INVALID: authorizationId, experimentRunId, authorizationNonce, approvedBy, approvedAtIso, permittedEnvironment, and providerProjectId are required',
    );
  }

  // 7. Verify approvedAtIso (not future-dated) and expiresAtIso (not expired)
  assertAuthorizationTimeWindow(payload.approvedAtIso, payload.expiresAtIso, args.nowIso);

  // 8. Verify stage identity (STAGE1 only)
  const expectedStage = args.expectedStage ?? 'STAGE1';
  if (payload.stage !== 'STAGE1' || expectedStage !== 'STAGE1') {
    throw new Error(
      `LIVE_AUTHORIZATION_STAGE_MISMATCH: Stage 1 authorization cannot authorize stage "${expectedStage}"`,
    );
  }

  // 5–6. Recompute canonical manifest hash and verify all immutable experiment parameters
  assertSelectedBriefsMatchManifest(args.selectedBriefs, args.manifest);
  const recomputedManifestSha256 = computeStage1ManifestSha256(args.manifest);
  if (recomputedManifestSha256 !== args.manifest.manifestSha256) {
    throw new Error(
      `LIVE_AUTHORIZATION_MANIFEST_TAMPERED: recomputed manifest SHA-256 (${recomputedManifestSha256}) !== embedded (${args.manifest.manifestSha256})`,
    );
  }
  if (payload.manifestSha256 !== recomputedManifestSha256) {
    throw new Error('LIVE_AUTHORIZATION_MANIFEST_MISMATCH: authorization does not match recomputed Stage 1 manifest digest');
  }

  const expectedReasoningEffort =
    args.expectedReasoningEffort ?? STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort;
  const expectedTemperature =
    args.expectedTemperature ?? STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature;

  assertAuthorizationFieldsMatchManifest(
    payload,
    args.manifest,
    args.maxOutputTokensCap,
    expectedReasoningEffort,
    expectedTemperature,
  );

  // 9. Verify authorized cost and call ceilings
  assertPositiveIntegerInRange(
    payload.authorizedCeilingMicroUsd,
    args.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    'LIVE_AUTHORIZATION_CEILING_INVALID',
    'authorizedCeilingMicroUsd',
  );
  assertPositiveIntegerInRange(
    payload.maxBillableCalls,
    args.manifest.callGraphPlan.runMaxBillableCallsCeiling,
    'LIVE_AUTHORIZATION_CALL_CEILING_INVALID',
    'maxBillableCalls',
  );
  if (payload.modelId !== args.contract.modelId || payload.pricingVersion !== args.contract.pricingVersion) {
    throw new Error('LIVE_AUTHORIZATION_MODEL_MISMATCH: authorization model/pricing does not match pinned contract');
  }

  // 10. Verify run ID, environment, provider project, and replay protection
  if (args.expectedRunId && payload.experimentRunId !== args.expectedRunId) {
    throw new Error(
      `LIVE_AUTHORIZATION_RUN_ID_MISMATCH: authorization experimentRunId="${payload.experimentRunId}" !== requested "${args.expectedRunId}"`,
    );
  }
  if (
    args.expectedPermittedEnvironment &&
    payload.permittedEnvironment !== args.expectedPermittedEnvironment
  ) {
    throw new Error(
      `LIVE_AUTHORIZATION_ENVIRONMENT_MISMATCH: authorization permittedEnvironment="${payload.permittedEnvironment}" !== "${args.expectedPermittedEnvironment}"`,
    );
  }
  if (
    args.expectedProviderProjectId &&
    payload.providerProjectId !== args.expectedProviderProjectId
  ) {
    throw new Error(
      `LIVE_AUTHORIZATION_PROJECT_MISMATCH: authorization providerProjectId="${payload.providerProjectId}" !== "${args.expectedProviderProjectId}"`,
    );
  }
  if (payload.providerSpendingCapConfirmed !== true) {
    throw new Error('LIVE_AUTHORIZATION_NO_PROVIDER_CAP: provider-side spending cap must be confirmed');
  }
  if (!args.liveTransport) {
    throw new Error('LIVE_TRANSPORT_NOT_CONFIGURED: no live provider transport injected (real network calls disabled offline)');
  }

  if (!args.nonceLedger) {
    throw new Error(
      'LIVE_AUTHORIZATION_NONCE_LEDGER_REQUIRED: live execution requires an explicit AuthorizationNonceLedger for replay protection',
    );
  }
  args.nonceLedger.claimOrVerifyResume({
    authorizationNonce: payload.authorizationNonce,
    experimentRunId: payload.experimentRunId,
    manifestSha256: recomputedManifestSha256,
    claimedAtIso: args.nowIso,
    isExplicitResume: Boolean(args.isExplicitResume),
  });

  // 12. Bind verified authorization to immutable execution snapshot
  return deepFreeze({
    manifestSha256: recomputedManifestSha256,
    manifest: structuredClone(args.manifest),
    selectedBriefs: structuredClone([...args.selectedBriefs]),
    contract: structuredClone(args.contract),
    authorization: structuredClone(auth),
    authorizationDigestSha256: verifiedSig.canonicalSha256,
    experimentRunId: payload.experimentRunId,
    ceilingMicroUsd: payload.authorizedCeilingMicroUsd,
    maxBillableCalls: payload.maxBillableCalls,
    maxOutputTokensCap: payload.maxOutputTokensCap,
    maxRetriesPerTrial: payload.maxRetriesPerTrial,
    reasoningEffort: expectedReasoningEffort,
    temperature: expectedTemperature,
    providerProjectId: payload.providerProjectId,
    permittedEnvironment: payload.permittedEnvironment,
    providerCapConfirmed: payload.providerSpendingCapConfirmed,
  });
}

function estimatePromptTokens(prompt: string): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(prompt, 'utf8') / 2));
}

interface ResolvedArmPrompt {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly responseFormat: EvalResponseFormatMode;
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
    responseFormat: STAGE1_EXPERIMENTAL_CONFIG.armAResponseFormat,
  };
}

function resolveExecutionPlan(args: {
  readonly mode: 'mock_transport' | 'live_provider';
  readonly liveExecutionEnabled: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly pricingContract: PinnedModelPricingContract;
  readonly maxOutputTokensCap: number;
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly temperature: number;
  readonly nowIso: string;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly trustAnchor?: FounderTrustAnchor | null;
  readonly nonceLedger?: AuthorizationNonceLedger;
  readonly expectedRunId?: string;
  readonly expectedStage?: string;
  readonly expectedPermittedEnvironment?: string;
  readonly expectedProviderProjectId?: string;
  readonly isExplicitResume?: boolean;
  readonly mockTransport?: EvalTransportFn;
  readonly liveTransport?: EvalTransportFn;
}): {
  readonly transport: EvalTransportFn;
  readonly snapshot: ImmutableExecutionSnapshot;
} {
  if (args.mode === 'live_provider') {
    const snapshot = assertLiveAuthorization({
      liveExecutionEnabled: args.liveExecutionEnabled,
      manifest: args.manifest,
      selectedBriefs: args.selectedBriefs,
      contract: args.pricingContract,
      maxOutputTokensCap: args.maxOutputTokensCap,
      expectedReasoningEffort: args.reasoningEffort,
      expectedTemperature: args.temperature,
      nowIso: args.nowIso,
      authorization: args.authorization,
      trustAnchor: args.trustAnchor,
      nonceLedger: args.nonceLedger,
      expectedRunId: args.expectedRunId,
      expectedStage: args.expectedStage,
      expectedPermittedEnvironment: args.expectedPermittedEnvironment,
      expectedProviderProjectId: args.expectedProviderProjectId,
      isExplicitResume: args.isExplicitResume,
      liveTransport: args.liveTransport,
    });
    return {
      transport: args.liveTransport as EvalTransportFn,
      snapshot,
    };
  }
  const recomputedManifestSha256 = computeStage1ManifestSha256(args.manifest);
  const snapshot = deepFreeze({
    manifestSha256: recomputedManifestSha256,
    manifest: structuredClone(args.manifest),
    selectedBriefs: structuredClone([...args.selectedBriefs]),
    contract: structuredClone(args.pricingContract),
    authorization: null,
    authorizationDigestSha256: null,
    experimentRunId: args.expectedRunId ?? null,
    ceilingMicroUsd: args.manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    maxBillableCalls: args.manifest.callGraphPlan.runMaxBillableCallsCeiling,
    maxOutputTokensCap: args.maxOutputTokensCap,
    maxRetriesPerTrial: args.manifest.callGraphPlan.maxRetriesPerTrial,
    reasoningEffort: args.reasoningEffort,
    temperature: args.temperature,
    providerProjectId: args.expectedProviderProjectId ?? null,
    permittedEnvironment: args.expectedPermittedEnvironment ?? null,
    providerCapConfirmed: true,
  });
  return {
    transport: args.mockTransport ?? createDeterministicMockTransport(args.pricingContract),
    snapshot,
  };
}

function countPairCompletions(
  selectedBriefs: readonly EvaluationBrief[],
  trials: readonly AdapterTrialEvidence[],
  governorSnapshot: CostGovernorSnapshot,
  receipts: readonly CallUsageReceipt[],
  previouslyCompletedTrialIds: readonly string[],
): { readonly completedPairsCount: number; readonly incompletePairsCount: number } {
  const summary = countAuthoritativePairCompletions({
    trials,
    governorSnapshot,
    receipts,
    selectedBriefIds: selectedBriefs.map((b) => b.briefId),
    previouslyCompletedTrialIds,
  });
  return {
    completedPairsCount: summary.completedPairs,
    incompletePairsCount: selectedBriefs.length - summary.completedPairs,
  };
}

function resolveCalibrationClock(
  mode: 'mock_transport' | 'live_provider',
  nowIso?: () => string,
): () => string {
  if (nowIso) return nowIso;
  return mode === 'live_provider' ? () => new Date().toISOString() : () => '2026-11-23T00:00:00.000Z';
}

function isBriefPairAlreadyCompleted(
  briefId: string,
  previouslyCompletedIds: ReadonlySet<string>,
): boolean {
  return BENCHMARK_ARMS.every((armId) => previouslyCompletedIds.has(`${briefId}:${armId}:t1`));
}

async function runCalibrationBriefLoop(params: {
  readonly callerManifest: Stage1CalibrationManifest;
  readonly snapshot: ImmutableExecutionSnapshot;
  readonly mode: 'mock_transport' | 'live_provider';
  readonly targetDurationSec: number;
  readonly temperature: number;
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly governor: ExperimentCostGovernor;
  readonly transport: EvalTransportFn;
  readonly receipts: CallUsageReceipt[];
  readonly trials: AdapterTrialEvidence[];
  readonly previouslyCompletedIds: ReadonlySet<string>;
  readonly nowIso: () => string;
}): Promise<string | null> {
  let haltedReason: string | null = null;
  for (const brief of params.snapshot.selectedBriefs) {
    if (haltedReason) break;
    // P2-A TOCTOU guard: detect post-validation mutation of the caller's manifest before starting a pair
    if (computeStage1ManifestSha256(params.callerManifest) !== params.snapshot.manifestSha256) {
      return 'MANIFEST_MUTATED_AFTER_VALIDATION';
    }
    if (isBriefPairAlreadyCompleted(brief.briefId, params.previouslyCompletedIds)) {
      continue;
    }
    haltedReason = await executeBriefPair({
      brief,
      mode: params.mode,
      maxRetries: params.snapshot.maxRetriesPerTrial,
      maxOutputTokensCap: params.snapshot.maxOutputTokensCap,
      targetDurationSec: params.targetDurationSec,
      temperature: params.temperature,
      reasoningEffort: params.reasoningEffort,
      contract: params.snapshot.contract,
      governor: params.governor,
      transport: params.transport,
      receipts: params.receipts,
      trials: params.trials,
      previouslyCompletedIds: params.previouslyCompletedIds,
      nowIso: params.nowIso,
    });
  }
  return haltedReason;
}

export async function runBudgetGatedCalibration(args: {
  readonly mode?: 'mock_transport' | 'live_provider';
  readonly liveExecutionEnabled?: boolean;
  readonly manifest: Stage1CalibrationManifest;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly pricingContract: PinnedModelPricingContract;
  readonly authorization?: ExperimentAuthorizationRecord;
  readonly trustAnchor?: FounderTrustAnchor | null;
  readonly nonceLedger?: AuthorizationNonceLedger;
  readonly expectedRunId?: string;
  readonly expectedStage?: string;
  readonly expectedPermittedEnvironment?: string;
  readonly expectedProviderProjectId?: string;
  readonly mockTransport?: EvalTransportFn;
  readonly liveTransport?: EvalTransportFn;
  readonly resumeFromSnapshot?: CostGovernorSnapshot;
  readonly maxPromptTokensBudget?: number;
  readonly maxOutputTokensCap?: number;
  readonly targetDurationSec?: number;
  readonly temperature?: number;
  readonly reasoningEffort?: OpenAiReasoningEffort;
  readonly extraSchemaOverheadTokens?: number;
  readonly nowIso?: () => string;
}): Promise<CalibrationRunResult> {
  assertSelectedBriefsMatchManifest(args.selectedBriefs, args.manifest);
  const mode = args.mode ?? 'mock_transport';
  const liveExecutionEnabled = args.liveExecutionEnabled ?? LIVE_ADAPTER_ENABLED_BY_DEFAULT;
  const nowIso = resolveCalibrationClock(mode, args.nowIso);

  const maxOutputTokensCap = args.maxOutputTokensCap ?? STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap;
  const maxPromptTokensBudget = args.maxPromptTokensBudget ?? 4000;
  const targetDurationSec = args.targetDurationSec ?? STAGE1_DEFAULT_TARGET_DURATION_SEC;
  const temperature = args.temperature ?? STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature;
  const reasoningEffort = args.reasoningEffort ?? STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort;

  if (args.resumeFromSnapshot && args.resumeFromSnapshot.admittedCalls <= 0) {
    throw new Error(
      'AUTHORIZATION_RESUME_EMPTY_SNAPSHOT: cannot resume from a snapshot with zero admittedCalls',
    );
  }
  const plan = resolveExecutionPlan({
    mode,
    liveExecutionEnabled,
    manifest: args.manifest,
    selectedBriefs: args.selectedBriefs,
    pricingContract: args.pricingContract,
    maxOutputTokensCap,
    reasoningEffort,
    temperature,
    nowIso: nowIso(),
    authorization: args.authorization,
    trustAnchor: args.trustAnchor,
    nonceLedger: args.nonceLedger,
    expectedRunId: args.expectedRunId,
    expectedStage: args.expectedStage,
    expectedPermittedEnvironment: args.expectedPermittedEnvironment,
    expectedProviderProjectId: args.expectedProviderProjectId,
    isExplicitResume: Boolean(args.resumeFromSnapshot),
    mockTransport: args.mockTransport,
    liveTransport: args.liveTransport,
  });
  const { snapshot } = plan;

  if (snapshot.contract.provider === 'openai') {
    buildOpenAiDirectRequestPayload({
      modelId: snapshot.contract.modelId,
      prompt: 'preflight',
      maxOutputTokens: snapshot.maxOutputTokensCap,
      temperature,
      reasoningEffort,
      responseFormat: STAGE1_EXPERIMENTAL_CONFIG.armAResponseFormat,
      armId: 'arm_a_sophia_basic',
    });
  }

  const callPolicySummary = computeStage1CallPolicySummary({
    targetPairs: snapshot.selectedBriefs.length,
    maxRetriesPerTrial: snapshot.maxRetriesPerTrial,
    maxBillableCalls: snapshot.maxBillableCalls,
  });

  const governorConfig = {
    plannedLogicalTrials: snapshot.selectedBriefs.length * BENCHMARK_ARMS.length,
    plannedProviderCalls: snapshot.selectedBriefs.length * BENCHMARK_ARMS.length,
    maxBillableCalls: snapshot.maxBillableCalls,
    maxRetriesPerTrial: snapshot.maxRetriesPerTrial,
    maxPromptTokensBudget,
    maxOutputTokensCap: snapshot.maxOutputTokensCap,
    authorizedCeilingMicroUsd: snapshot.ceilingMicroUsd,
    spendingAuthorized: true,
    providerSpendingCapConfirmed: snapshot.providerCapConfirmed,
    pricingContract: snapshot.contract,
  };
  const governor = args.resumeFromSnapshot
    ? ExperimentCostGovernor.fromSnapshot(governorConfig, args.resumeFromSnapshot)
    : new ExperimentCostGovernor(governorConfig);

  const preflightFeasibility = assessOutputTokenCapFeasibility(snapshot.maxOutputTokensCap, {
    briefs: snapshot.selectedBriefs,
    minScenes: STAGE1_ARM_A_MIN_SCENES,
    targetDurationSec,
    reasoningEffort,
    extraSchemaOverheadTokens: args.extraSchemaOverheadTokens,
  });
  const resumedIds = args.resumeFromSnapshot?.completedTrialIds ?? [];
  if (!preflightFeasibility.feasible) {
    const govSnap = governor.exportSnapshot();
    const pairCounts = countPairCompletions(snapshot.selectedBriefs, [], govSnap, [], resumedIds);
    return {
      transportMode: mode,
      manifestSha256: snapshot.manifestSha256,
      nextStageAutoStart: false,
      haltedReason: `PREFLIGHT_INFEASIBLE:${preflightFeasibility.redesignCode ?? 'STAGE1_TOKEN_CAP_REDESIGN_REQUIRED'}`,
      preflightFeasibility,
      callPolicySummary,
      completedPairsCount: pairCounts.completedPairsCount,
      incompletePairsCount: pairCounts.incompletePairsCount,
      trials: [],
      receipts: [],
      costGovernorSnapshot: govSnap,
    };
  }

  const receipts: CallUsageReceipt[] = [];
  const trials: AdapterTrialEvidence[] = [];
  const haltedReason = await runCalibrationBriefLoop({
    callerManifest: args.manifest,
    snapshot,
    mode,
    targetDurationSec,
    temperature,
    reasoningEffort,
    governor,
    transport: plan.transport,
    receipts,
    trials,
    previouslyCompletedIds: new Set<string>(resumedIds),
    nowIso,
  });
  const finalSnapshot = governor.exportSnapshot();
  const pairCounts = countPairCompletions(
    snapshot.selectedBriefs,
    trials,
    finalSnapshot,
    receipts,
    resumedIds,
  );
  if (
    mode === 'live_provider' &&
    haltedReason === null &&
    pairCounts.completedPairsCount === snapshot.selectedBriefs.length &&
    snapshot.authorization
  ) {
    args.nonceLedger?.markRunFinalized?.({
      authorizationNonce: snapshot.authorization.payload.authorizationNonce,
      experimentRunId: snapshot.authorization.payload.experimentRunId,
      finalizedAtIso: nowIso(),
    });
  }

  return {
    transportMode: mode,
    manifestSha256: snapshot.manifestSha256,
    nextStageAutoStart: false,
    haltedReason,
    preflightFeasibility,
    callPolicySummary,
    completedPairsCount: pairCounts.completedPairsCount,
    incompletePairsCount: pairCounts.incompletePairsCount,
    trials,
    receipts,
    costGovernorSnapshot: finalSnapshot,
  };
}

interface BriefPairExecutionContext {
  readonly brief: EvaluationBrief;
  readonly mode: 'mock_transport' | 'live_provider';
  readonly maxRetries: number;
  readonly maxOutputTokensCap: number;
  readonly targetDurationSec: number;
  readonly temperature: number;
  readonly reasoningEffort: OpenAiReasoningEffort;
  readonly contract: PinnedModelPricingContract;
  readonly governor: ExperimentCostGovernor;
  readonly transport: EvalTransportFn;
  readonly receipts: CallUsageReceipt[];
  readonly trials: AdapterTrialEvidence[];
  readonly previouslyCompletedIds: ReadonlySet<string>;
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
    if (ctx.previouslyCompletedIds.has(trialId)) {
      continue;
    }
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
      reasoningEffort: ctx.reasoningEffort,
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
  readonly reasoningEffort: OpenAiReasoningEffort;
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
  const failureCategory: TrialFailureCategory =
    code === 'BUDGET_CEILING_EXCEEDED' || code === 'CALL_CEILING_EXCEEDED'
      ? 'BUDGET_EXHAUSTED'
      : 'PROVIDER_FAILURE';
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
    liabilityHeldMicroUsd: 0,
    outcome: 'ADMISSION_REJECTED',
    failureClass: code,
    failureCategory,
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
      outputContractValid: false,
      providerResponseId: null,
      providerModelVersion: null,
      observedCostMicroUsd: null,
      trialRecord: null,
      failureClass: code,
      failureCategory,
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
  readonly liabilityHeldMicroUsd: number;
  readonly outcome: 'SUCCESS' | 'COST_RECONCILIATION_REQUIRED' | 'FAILED_TERMINAL';
  readonly failureClass?: string;
  readonly failureCategory?: TrialFailureCategory;
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
    reasoningTokens: args.res.reasoningTokens ?? null,
    finishReason: args.res.finishReason ?? null,
    reservedMicroUsd: args.reservedMicroUsd,
    observedCostMicroUsd: args.observedCostMicroUsd,
    liabilityHeldMicroUsd: args.liabilityHeldMicroUsd,
    outcome: args.outcome,
    ...(args.failureClass ? { failureClass: args.failureClass } : {}),
    ...(args.failureCategory ? { failureCategory: args.failureCategory } : {}),
  };
}

function isProviderLengthTruncation(finishReason: string | null | undefined): boolean {
  return finishReason === 'length' || finishReason === 'incomplete' || finishReason === 'max_output_tokens';
}

function validateResponseOutput(
  ctx: TrialAttemptContext,
  res: EvalTransportResponse,
):
  | { readonly ok: true; readonly renderedOutput: string }
  | {
      readonly ok: false;
      readonly failureClass: string;
      readonly failureCategory: TrialFailureCategory;
      readonly haltReason: string | null;
    } {
  const providerTruncated = isProviderLengthTruncation(res.finishReason);

  if (ctx.armId !== 'arm_a_sophia_basic') {
    if (providerTruncated) {
      return {
        ok: false,
        failureClass: 'TOKEN_CAP_EXHAUSTED',
        failureCategory: 'TOKEN_CAP_EXHAUSTED',
        haltReason: 'TOKEN_CAP_EXHAUSTED:PROVIDER_LENGTH_FINISH',
      };
    }
    return { ok: true, renderedOutput: res.renderedOutput };
  }

  const validated = parseAndValidateArmAOutput(res.renderedOutput, {
    minScenes: STAGE1_ARM_A_MIN_SCENES,
    targetDurationSec: ctx.targetDurationSec,
  });
  if (validated.ok) {
    if (providerTruncated) {
      return {
        ok: false,
        failureClass: 'TOKEN_CAP_EXHAUSTED',
        failureCategory: 'TOKEN_CAP_EXHAUSTED',
        haltReason: 'TOKEN_CAP_EXHAUSTED:PROVIDER_LENGTH_FINISH',
      };
    }
    return { ok: true, renderedOutput: validated.renderedOutput };
  }

  const hitTokenCap =
    providerTruncated ||
    (validated.errorCode === 'INVALID_JSON' &&
      res.completionTokens !== null &&
      res.completionTokens >= ctx.maxOutputTokensCap);

  if (hitTokenCap) {
    return {
      ok: false,
      failureClass: 'TOKEN_CAP_EXHAUSTED',
      failureCategory: 'TOKEN_CAP_EXHAUSTED',
      haltReason: 'TOKEN_CAP_EXHAUSTED:MAX_OUTPUT_TOKENS_TRUNCATED',
    };
  }
  return {
    ok: false,
    failureClass: validated.errorCode,
    failureCategory: 'INVALID_MODEL_OUTPUT',
    haltReason: null,
  };
}

function buildAdapterTrialExecutionRecord(args: {
  readonly ctx: TrialAttemptContext;
  readonly attempt: number;
  readonly res: EvalTransportResponse;
  readonly renderedOutput: string;
  readonly outputSha256: string;
  readonly observedCostMicroUsd: number | null;
}): TrialExecutionRecord {
  const isLive = args.ctx.mode === 'live_provider';
  const hasUsage =
    args.observedCostMicroUsd !== null &&
    args.res.promptTokens !== null &&
    args.res.completionTokens !== null;
  const missingReason = 'missing_provider_usage_metadata';

  return {
    trialId: args.ctx.trialId,
    briefId: args.ctx.brief.briefId,
    industry: args.ctx.brief.industry,
    armId: args.ctx.armId,
    trialNumber: 1,
    executionMode: isLive ? 'live_observed' : 'fixture_simulated',
    qualityStatus: 'QUALITY_NOT_MEASURED',
    renderedOutput: args.renderedOutput,
    inputSha256: args.ctx.inputSha256,
    outputSha256: args.outputSha256,
    orchestrationNotes: isLive
      ? `live_provider:${args.res.provider}`
      : `mock_transport:${args.res.provider}`,
    telemetry: {
      modelId: args.ctx.contract.modelId,
      modelVersion: args.res.responseModelId ?? args.ctx.contract.modelId,
      promptTokens: hasUsage
        ? { status: 'OBSERVED', value: args.res.promptTokens as number }
        : { status: 'NOT_MEASURED', reason: missingReason },
      completionTokens: hasUsage
        ? { status: 'OBSERVED', value: args.res.completionTokens as number }
        : { status: 'NOT_MEASURED', reason: missingReason },
      retryCount: Math.max(0, args.attempt - 1),
      wallClockLatencyMs: Number.isSafeInteger(args.res.latencyMs) && args.res.latencyMs >= 0
        ? { status: 'OBSERVED', value: args.res.latencyMs }
        : { status: 'NOT_MEASURED', reason: 'invalid_latency_ms' },
      estimatedInferenceCostMicroUsd: hasUsage
        ? { status: 'OBSERVED', value: args.observedCostMicroUsd as number }
        : { status: 'NOT_MEASURED', reason: missingReason },
      measuredInferenceCostMicroUsd: hasUsage
        ? { status: 'OBSERVED', value: args.observedCostMicroUsd as number }
        : { status: 'NOT_MEASURED', reason: missingReason },
      infrastructureCostAllocationMicroUsd: 0,
      realPaidInferenceCostMicroUsd: isLive && hasUsage ? (args.observedCostMicroUsd as number) : 0,
    },
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
  const outputCheck = validateResponseOutput(ctx, res);
  const providerResponseId = res.responseId?.trim()
    ? res.responseId
    : res.modelFingerprint?.trim()
      ? res.modelFingerprint
      : null;
  const providerModelVersion = res.responseModelId?.trim() ? res.responseModelId : null;
  const hasRequiredProvenance =
    Boolean(providerResponseId?.trim()) && Boolean(providerModelVersion?.trim());

  const reconciled = ctx.governor.reconcileSuccess(admissionId, {
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    cachedPromptTokens: res.cachedPromptTokens,
    observedChargedMicroUsd: res.observedChargedMicroUsd,
    trialSucceeded: outputCheck.ok && hasRequiredProvenance,
  });
  const missingUsageHalt = reconciled.observedCostMicroUsd === null ? 'MISSING_USAGE_METADATA' : null;

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
        liabilityHeldMicroUsd: reconciled.observedCostMicroUsd === null ? reservedMicroUsd : 0,
        outcome: 'FAILED_TERMINAL',
        failureClass: outputCheck.failureClass,
        failureCategory: outputCheck.failureCategory,
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
        outputContractValid: false,
        providerResponseId,
        providerModelVersion,
        observedCostMicroUsd: reconciled.observedCostMicroUsd,
        trialRecord: null,
        failureClass: outputCheck.failureClass,
        failureCategory: outputCheck.failureCategory,
        parityStatus: parity.status,
      },
      haltReason: outputCheck.haltReason ?? missingUsageHalt,
    };
  }

  const outputSha256 = computeSha256Hex(outputCheck.renderedOutput);
  const trialRecord = buildAdapterTrialExecutionRecord({
    ctx,
    attempt,
    res,
    renderedOutput: outputCheck.renderedOutput,
    outputSha256,
    observedCostMicroUsd: reconciled.observedCostMicroUsd,
  });

  if (reconciled.observedCostMicroUsd === null) {
    ctx.receipts.push(
      buildObservedReceipt({
        ctx,
        attempt,
        admissionId,
        reservedMicroUsd,
        res,
        parity,
        observedCostMicroUsd: null,
        liabilityHeldMicroUsd: reservedMicroUsd,
        outcome: 'COST_RECONCILIATION_REQUIRED',
      }),
    );
    return {
      evidence: {
        trialId: ctx.trialId,
        briefId: ctx.brief.briefId,
        armId: ctx.armId,
        inputSha256: ctx.inputSha256,
        outputSha256,
        renderedOutput: outputCheck.renderedOutput,
        status: 'COST_RECONCILIATION_REQUIRED',
        outputContractValid: true,
        providerResponseId,
        providerModelVersion,
        observedCostMicroUsd: null,
        trialRecord,
        parityStatus: parity.status,
      },
      haltReason: missingUsageHalt,
    };
  }

  if (!hasRequiredProvenance) {
    ctx.receipts.push(
      buildObservedReceipt({
        ctx,
        attempt,
        admissionId,
        reservedMicroUsd,
        res,
        parity,
        observedCostMicroUsd: reconciled.observedCostMicroUsd,
        liabilityHeldMicroUsd: 0,
        outcome: 'FAILED_TERMINAL',
        failureClass: 'MALFORMED_PROVIDER_RESPONSE',
        failureCategory: 'PROVIDER_FAILURE',
      }),
    );
    return {
      evidence: {
        trialId: ctx.trialId,
        briefId: ctx.brief.briefId,
        armId: ctx.armId,
        inputSha256: ctx.inputSha256,
        outputSha256,
        renderedOutput: outputCheck.renderedOutput,
        status: 'FAILED',
        outputContractValid: true,
        providerResponseId,
        providerModelVersion,
        observedCostMicroUsd: reconciled.observedCostMicroUsd,
        trialRecord,
        failureClass: 'MALFORMED_PROVIDER_RESPONSE',
        failureCategory: 'PROVIDER_FAILURE',
        parityStatus: parity.status,
      },
      haltReason: 'MISSING_PROVIDER_PROVENANCE',
    };
  }

  const governorAccepted = ctx.governor.exportSnapshot().completedTrialIds.includes(ctx.trialId);
  ctx.receipts.push(
    buildObservedReceipt({
      ctx,
      attempt,
      admissionId,
      reservedMicroUsd,
      res,
      parity,
      observedCostMicroUsd: reconciled.observedCostMicroUsd,
      liabilityHeldMicroUsd: 0,
      outcome: 'SUCCESS',
    }),
  );
  return {
    evidence: {
      trialId: ctx.trialId,
      briefId: ctx.brief.briefId,
      armId: ctx.armId,
      inputSha256: ctx.inputSha256,
      outputSha256,
      renderedOutput: outputCheck.renderedOutput,
      status: governorAccepted ? 'COMPLETED' : 'COST_RECONCILIATION_REQUIRED',
      outputContractValid: true,
      providerResponseId,
      providerModelVersion,
      observedCostMicroUsd: reconciled.observedCostMicroUsd,
      trialRecord,
      parityStatus: parity.status,
    },
    haltReason: null,
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
    liabilityHeldMicroUsd: reservedMicroUsd,
    outcome: 'FAILED_TERMINAL',
    failureClass: 'TRANSPORT_EXCEPTION',
    failureCategory: 'PROVIDER_FAILURE',
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
      outputContractValid: false,
      providerResponseId: null,
      providerModelVersion: null,
      observedCostMicroUsd: null,
      trialRecord: null,
      failureClass: 'TRANSPORT_EXCEPTION',
      failureCategory: 'PROVIDER_FAILURE',
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
    },
    haltReason: 'UNCERTAIN_FAILURE:TRANSPORT_EXCEPTION',
  };
}

function recordTransportFailure(
  ctx: TrialAttemptContext,
  attempt: number,
  admissionId: string,
  reservedMicroUsd: number,
  res: EvalTransportFailure,
): { readonly canRetry: boolean; readonly terminalResult?: { readonly evidence: AdapterTrialEvidence; readonly haltReason: string | null } } {
  const failureCategory: TrialFailureCategory =
    res.failureClass === 'SCHEMA_INVALID' ? 'INVALID_MODEL_OUTPUT' : 'PROVIDER_FAILURE';
  ctx.governor.reconcileFailure(admissionId, {
    acceptedByProvider: res.acceptedByProvider,
    httpStatus: res.httpStatus,
    reason: res.message,
  });
  const canRetry = res.retryable && !res.acceptedByProvider && attempt <= ctx.maxRetries;
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
    requestTimestampIso: res.requestTimestampIso,
    parityStatus: 'MODEL_PARITY_UNVERIFIED',
    parityReasons: [`call_failed:${res.failureClass}`],
    promptTokens: null,
    completionTokens: null,
    reservedMicroUsd,
    observedCostMicroUsd: null,
    liabilityHeldMicroUsd: res.acceptedByProvider ? reservedMicroUsd : 0,
    outcome: canRetry ? 'FAILED_RETRYABLE' : 'FAILED_TERMINAL',
    failureClass: res.failureClass,
    failureCategory,
  });
  if (canRetry) {
    return { canRetry: true };
  }
  return {
    canRetry: false,
    terminalResult: {
      evidence: {
        trialId: ctx.trialId,
        briefId: ctx.brief.briefId,
        armId: ctx.armId,
        inputSha256: ctx.inputSha256,
        outputSha256: null,
        renderedOutput: null,
        status: 'FAILED',
        outputContractValid: false,
        providerResponseId: null,
        providerModelVersion: null,
        observedCostMicroUsd: null,
        trialRecord: null,
        failureClass: res.failureClass,
        failureCategory,
        parityStatus: 'MODEL_PARITY_UNVERIFIED',
      },
      haltReason: res.acceptedByProvider
        ? `UNCERTAIN_FAILURE:${res.failureClass}`
        : res.failureClass === 'AUTH_ERROR'
          ? 'AUTH_ERROR'
          : null,
    },
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
        reasoningEffort: ctx.reasoningEffort,
        responseFormat: ctx.resolvedPrompt.responseFormat,
      });
    } catch (err) {
      return recordTransportException(ctx, attempt, decision.admissionId, decision.reservedMicroUsd, err);
    }

    if (res.ok) {
      return recordTransportSuccess(ctx, attempt, decision.admissionId, decision.reservedMicroUsd, res);
    }

    lastFailureClass = res.failureClass;
    const failureOutcome = recordTransportFailure(ctx, attempt, decision.admissionId, decision.reservedMicroUsd, res);
    if (!failureOutcome.canRetry && failureOutcome.terminalResult) {
      return failureOutcome.terminalResult;
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
      outputContractValid: false,
      providerResponseId: null,
      providerModelVersion: null,
      observedCostMicroUsd: null,
      trialRecord: null,
      failureClass: lastFailureClass,
      failureCategory: 'PROVIDER_FAILURE',
      parityStatus: 'MODEL_PARITY_UNVERIFIED',
    },
    haltReason: null,
  };
}

export type {
  DeferredUsageReconciliationPayload,
  DeferredUsageReconciliationRecord,
};

/**
 * Explicit authorized state transition that completes a COST_RECONCILIATION_REQUIRED
 * trial once trusted provider billing/usage evidence is supplied and cryptographically
 * signed by the operator-controlled Founder trust anchor.
 */
export function reconcileDeferredTrialUsage(args: {
  readonly runResult: CalibrationRunResult;
  readonly selectedBriefs: readonly EvaluationBrief[];
  readonly pricingContract: PinnedModelPricingContract;
  readonly maxOutputTokensCap?: number;
  readonly maxPromptTokensBudget?: number;
  readonly reconciliation: DeferredUsageReconciliationRecord;
  readonly trustAnchor: FounderTrustAnchor | null | undefined;
}): CalibrationRunResult {
  assertStrictDeferredReconciliationEnvelope(args.reconciliation);
  const { payload } = args.reconciliation;
  if (payload.domain !== FOUNDER_RECONCILIATION_DOMAIN) {
    throw new Error(
      `DEFERRED_RECONCILIATION_DOMAIN_INVALID: unexpected domain "${String(payload.domain)}"`,
    );
  }
  if (payload.manifestSha256 !== args.runResult.manifestSha256) {
    throw new Error(
      'DEFERRED_RECONCILIATION_MANIFEST_MISMATCH: manifestSha256 does not match runResult',
    );
  }
  verifyDetachedEd25519Signature({
    domain: FOUNDER_RECONCILIATION_DOMAIN,
    payload,
    signatureBase64: args.reconciliation.signatureBase64,
    trustAnchor: args.trustAnchor,
    expectedSignerKeyId: payload.founderSignerKeyId,
  });

  const targetIdx = args.runResult.trials.findIndex((t) => t.trialId === payload.trialId);
  if (targetIdx === -1) {
    throw new Error(`DEFERRED_RECONCILIATION_TRIAL_NOT_FOUND: "${payload.trialId}"`);
  }
  const existing = args.runResult.trials[targetIdx];
  if (existing.status !== 'COST_RECONCILIATION_REQUIRED') {
    throw new Error(
      `DEFERRED_RECONCILIATION_INVALID_STATE: trial "${payload.trialId}" is in status "${existing.status}", expected COST_RECONCILIATION_REQUIRED`,
    );
  }
  if (!existing.outputContractValid || !existing.trialRecord || existing.outputSha256 !== payload.outputSha256) {
    throw new Error(
      `DEFERRED_RECONCILIATION_OUTPUT_MISMATCH: preserved artifact for "${payload.trialId}" does not match signed outputSha256`,
    );
  }

  const snap = args.runResult.costGovernorSnapshot;
  const governor = ExperimentCostGovernor.fromSnapshot(
    {
      plannedLogicalTrials: snap.plannedLogicalTrials,
      plannedProviderCalls: snap.plannedProviderCalls,
      maxBillableCalls: snap.maxBillableCalls,
      maxRetriesPerTrial: args.runResult.callPolicySummary.maxRetriesPerTrial,
      maxPromptTokensBudget: args.maxPromptTokensBudget ?? 4000,
      maxOutputTokensCap: args.maxOutputTokensCap ?? STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
      authorizedCeilingMicroUsd: snap.authorizedCeilingMicroUsd,
      spendingAuthorized: true,
      providerSpendingCapConfirmed: true,
      pricingContract: args.pricingContract,
    },
    snap,
  );

  const reconciled = governor.reconcileDeferredUsage({
    trialId: payload.trialId,
    promptTokens: payload.promptTokens,
    completionTokens: payload.completionTokens,
    cachedPromptTokens: payload.cachedPromptTokens,
    observedChargedMicroUsd: payload.observedChargedMicroUsd,
    trialSucceeded: true,
    authorizedBy: payload.founderSignerKeyId,
  });

  const isLive = args.runResult.transportMode === 'live_provider';
  const updatedTrialRecord: TrialExecutionRecord = {
    ...existing.trialRecord,
    telemetry: {
      ...existing.trialRecord.telemetry,
      promptTokens: { status: 'OBSERVED', value: payload.promptTokens },
      completionTokens: { status: 'OBSERVED', value: payload.completionTokens },
      estimatedInferenceCostMicroUsd: { status: 'OBSERVED', value: reconciled.observedCostMicroUsd },
      measuredInferenceCostMicroUsd: { status: 'OBSERVED', value: reconciled.observedCostMicroUsd },
      realPaidInferenceCostMicroUsd: isLive ? reconciled.observedCostMicroUsd : 0,
    },
  };

  const updatedTrial: AdapterTrialEvidence = {
    ...existing,
    status: 'COMPLETED',
    observedCostMicroUsd: reconciled.observedCostMicroUsd,
    trialRecord: updatedTrialRecord,
  };

  const updatedTrials = args.runResult.trials.map((t, idx) => (idx === targetIdx ? updatedTrial : t));
  const priorReceiptsForTrial = args.runResult.receipts.filter(
    (r) => r.trialId === existing.trialId,
  );
  const latestPriorReceipt = priorReceiptsForTrial[priorReceiptsForTrial.length - 1];
  const reconciledReceipt: CallUsageReceipt = {
    receiptId: `${payload.trialId}:deferred-reconciled`,
    trialId: existing.trialId,
    briefId: existing.briefId,
    armId: existing.armId,
    attemptNumber: latestPriorReceipt?.attemptNumber ?? 1,
    transportMode: args.runResult.transportMode,
    provider: args.pricingContract.provider,
    requestedModelId: args.pricingContract.modelId,
    responseModelId: existing.providerModelVersion,
    modelFingerprint: latestPriorReceipt?.modelFingerprint ?? null,
    requestTimestampIso: payload.reconciledAtIso,
    parityStatus: existing.parityStatus,
    parityReasons: ['deferred_usage_reconciled'],
    promptTokens: payload.promptTokens,
    completionTokens: payload.completionTokens,
    reservedMicroUsd: reconciled.releasedUncertainLiabilityMicroUsd,
    observedCostMicroUsd: reconciled.observedCostMicroUsd,
    liabilityHeldMicroUsd: 0,
    outcome: 'SUCCESS',
  };
  const updatedReceipts = [...args.runResult.receipts, reconciledReceipt];
  const updatedSnapshot = governor.exportSnapshot();
  const finalityCheck = evaluateTrialFinality(updatedTrial, {
    governorSnapshot: updatedSnapshot,
    receipts: updatedReceipts,
  });
  if (!finalityCheck.completed) {
    throw new Error(
      `DEFERRED_RECONCILIATION_FINALITY_FAILED: reconciled trial "${existing.trialId}" failed finality check (${finalityCheck.reasons.join(', ')})`,
    );
  }
  const trialIdsInRun = new Set(updatedTrials.map((t) => t.trialId));
  const previouslyCompletedTrialIds = updatedSnapshot.completedTrialIds.filter(
    (id) => !trialIdsInRun.has(id),
  );
  const pairCounts = countPairCompletions(
    args.selectedBriefs,
    updatedTrials,
    updatedSnapshot,
    updatedReceipts,
    previouslyCompletedTrialIds,
  );

  return {
    ...args.runResult,
    haltedReason:
      updatedSnapshot.uncertainLiabilityMicroUsd === 0 &&
      args.runResult.haltedReason === 'MISSING_USAGE_METADATA'
        ? null
        : args.runResult.haltedReason,
    completedPairsCount: pairCounts.completedPairsCount,
    incompletePairsCount: pairCounts.incompletePairsCount,
    trials: updatedTrials,
    receipts: updatedReceipts,
    costGovernorSnapshot: updatedSnapshot,
  };
}
