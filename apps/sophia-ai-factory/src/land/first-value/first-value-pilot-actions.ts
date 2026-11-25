/**
 * Customer Pilot actions for /api/first-value:
 * - Pilot status inspection (invite allowlist, consent, quota, spend cap, financing mode)
 * - Consent acceptance (INVITE_ACCEPTED)
 * - Live AI script generation under single active financing mode (no BYOK->Founder fallback)
 * - Fail-closed cost controls, atomic spend & concurrency locks, conservative failure accounting
 * - Inline script editing with 3-scene validation and optimistic version locking
 * - Customer feedback capture (CUSTOMER_FEEDBACK_SUBMITTED)
 *
 * Never exposes server-side API keys or logs customer keys/prompts/provider headers.
 *
 * @module land/first-value/first-value-pilot-actions
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import {
  InvalidScriptStructureError,
  validateParsedScriptStructure,
  type ScriptOutput,
} from '@/seed/ai/script-generator';
import {
  isEmailAllowedForPilot,
  isPilotInviteOnlyEnabled,
  isPilotLiveInferenceEnabled,
  PILOT_POLICY_VERSION,
  resolvePilotCostControls,
  resolvePilotFinancingMode,
  resolvePilotMaxGenerations,
  resolvePilotRefererOrigin,
  resolvePilotSponsoredOpenRouterKey,
  type PilotEnvSource,
  type PilotEventName,
  type PilotFundingMode,
  type PilotStatusSnapshot,
} from '@/seed/pilot/pilot-access-policy';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { getProvenanceLabel } from '@/tree/first-value/first-value-contract';
import {
  computeCreatePayloadHash,
  createOrReplayReview,
  findReviewByIdempotencyKey,
  updateReviewScript,
} from '@/tree/first-value/first-value-review-repo';
import {
  clearPilotInFlightLock,
  getPilotConsent,
  getPilotQuotaStatus,
  hasPilotEvent,
  recordPilotConsent,
  recordPilotEvent,
  recordPilotFeedback,
  releasePilotGenerationSlot,
  reservePilotGenerationSlot,
  type PilotConsentRecord,
  type PilotQuotaStatus,
} from '@/tree/first-value/pilot-state-repo';
import { listPilotSupportRequestsForUser } from '@/tree/first-value/pilot-support-repo';
import {
  listPilotAffiliateLinks,
  listPilotManualPublishes,
  listPilotMp4Exports,
} from '@/tree/first-value/pilot-commercial-repo';
import {
  jsonPrivate,
  resolveIdempotencyKey,
  type FirstValuePostPayload,
} from './first-value-http-schemas';

export interface PilotLiveUser {
  readonly id: string;
  readonly email?: string | null;
}

export interface LiveScriptGeneratorInput {
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly userId: string;
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
  readonly referer?: string;
}

export interface PilotRuntimeDeps {
  readonly env?: PilotEnvSource;
  readonly lookupOpenRouterByokKey?: (userId: string) => Promise<string | null>;
  readonly generateLiveScript?: (input: LiveScriptGeneratorInput) => Promise<ScriptOutput>;
  readonly nowMs?: () => number;
}

export type { PilotStatusSnapshot };

export function checkPilotAccessGuard(
  user: PilotLiveUser,
  env: PilotEnvSource = process.env,
): NextResponse | null {
  if (!isEmailAllowedForPilot(user.email, env)) {
    return jsonPrivate(
      {
        code: 'PILOT_ACCESS_REVOKED',
        error:
          'Your pilot access is not active or has been revoked. / Quyền truy cập bản thử nghiệm của bạn chưa được kích hoạt hoặc đã bị thu hồi.',
      },
      403,
    );
  }
  return null;
}

export async function safeRecordPilotEvent(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly eventName: PilotEventName;
    readonly artifactId?: string | null;
    readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
    readonly nowIso: string;
  },
): Promise<void> {
  try {
    await recordPilotEvent(d1, input);
  } catch {
    // Non-blocking telemetry when pilot tables are not migrated on non-pilot envs
  }
}

export async function buildPilotStatusSnapshot(
  d1: D1Database,
  args: {
    readonly orgId: string;
    readonly userId: string;
    readonly configuredProviders: readonly string[];
    readonly deps: PilotRuntimeDeps;
  },
): Promise<PilotStatusSnapshot> {
  const env = args.deps.env ?? process.env;
  const costControls = resolvePilotCostControls(env);
  const maxGenerations = costControls.ok
    ? costControls.config.maxGenerations
    : resolvePilotMaxGenerations(env);
  const maxSpendMicroUsd = costControls.ok
    ? costControls.config.maxEstimatedSpendMicroUsd
    : undefined;
  const liveInferenceEnabled = isPilotLiveInferenceEnabled(env);
  const financingMode = resolvePilotFinancingMode(env);
  const hasByokOpenRouter = args.configuredProviders.includes('openrouter');
  const hasByokHeyGen = args.configuredProviders.includes('heygen');
  const hasSponsoredKey = resolvePilotSponsoredOpenRouterKey(env) !== null;

  let fundingMode: PilotFundingMode = 'none';
  if (financingMode === 'FOUNDER_SPONSORED') {
    if (liveInferenceEnabled && hasSponsoredKey && costControls.ok) {
      fundingMode = 'founder_sponsored';
    }
  } else if (financingMode === 'CUSTOMER_BYOK') {
    if (hasByokOpenRouter) {
      fundingMode = 'customer_byok';
    }
  }

  let consent: PilotConsentRecord | null = null;
  let quota: PilotQuotaStatus = {
    usedGenerations: 0,
    maxGenerations,
    remainingGenerations: maxGenerations,
    lastGenerationAtIso: null,
    estimatedSpendUsd: 0,
    ...(costControls.ok
      ? { maxEstimatedSpendUsd: costControls.config.maxEstimatedSpendUsd }
      : {}),
  };

  try {
    consent = await getPilotConsent(d1, { orgId: args.orgId, userId: args.userId });
    quota = await getPilotQuotaStatus(d1, {
      orgId: args.orgId,
      userId: args.userId,
      maxGenerations,
      maxEstimatedSpendMicroUsd: maxSpendMicroUsd,
    });
  } catch {
    // Graceful fallback when pilot migration has not been applied on legacy envs
  }

  let supportRequests: PilotStatusSnapshot['supportRequests'] = [];
  try {
    supportRequests = await listPilotSupportRequestsForUser(d1, {
      orgId: args.orgId,
      userId: args.userId,
      limit: 5,
    });
  } catch {
    // Graceful fallback when support queue migration is absent on legacy envs
  }

  const baseOrigin = resolvePilotRefererOrigin(env);
  const affiliateLinks = await listPilotAffiliateLinks(d1, {
    orgId: args.orgId,
    userId: args.userId,
    baseOrigin,
  });
  const mp4Exports = await listPilotMp4Exports(d1, {
    orgId: args.orgId,
    userId: args.userId,
  });
  const manualPublishes = await listPilotManualPublishes(d1, {
    orgId: args.orgId,
    userId: args.userId,
  });

  return {
    inviteOnly: isPilotInviteOnlyEnabled(env),
    liveInferenceEnabled,
    policyVersion: PILOT_POLICY_VERSION,
    consentAccepted: Boolean(consent && consent.policyVersion === PILOT_POLICY_VERSION),
    consentAcceptedAtIso: consent?.acceptedAtIso ?? null,
    financingMode,
    fundingMode,
    modelId: costControls.ok ? costControls.config.modelId : 'openai/gpt-4o-mini',
    byokKeyConfigured: hasByokOpenRouter,
    heygenByokConfigured: hasByokHeyGen,
    quota,
    supportRequests,
    affiliateLinks,
    mp4Exports,
    manualPublishes,
  };
}

export async function handleAcceptPilotTerms(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'accept_pilot_terms' }>,
  deps: PilotRuntimeDeps,
): Promise<NextResponse> {
  if (payload.policyVersion !== PILOT_POLICY_VERSION) {
    return jsonPrivate(
      {
        code: 'INVALID_POLICY_VERSION',
        error: 'Unsupported pilot policy version',
        expectedVersion: PILOT_POLICY_VERSION,
      },
      400,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  let consent: PilotConsentRecord;
  try {
    consent = await recordPilotConsent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      policyVersion: payload.policyVersion,
      nowIso,
    });
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to persist pilot consent' },
      500,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'INVITE_ACCEPTED',
    metadata: { policyVersion: payload.policyVersion },
    nowIso,
  });

  const loggedFirstLogin = await hasPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'FIRST_LOGIN',
  }).catch(() => true);

  if (!loggedFirstLogin) {
    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'FIRST_LOGIN',
      metadata: { source: 'pilot_consent' },
      nowIso,
    });
  }

  return jsonPrivate(
    {
      consent,
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

export async function handleLiveProviderCreateReview(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'create_review' }>,
  idempotencyKey: string,
  deps: PilotRuntimeDeps,
): Promise<NextResponse> {
  const env = deps.env ?? process.env;
  if (!isPilotLiveInferenceEnabled(env)) {
    return jsonPrivate(
      { code: 'LIVE_INFERENCE_DISABLED', error: 'Live provider inference is disabled' },
      403,
    );
  }

  const costValidation = resolvePilotCostControls(env);
  if (!costValidation.ok) {
    return jsonPrivate(
      {
        code: 'PILOT_COST_CONTROLS_UNCONFIGURED',
        error:
          'Pilot cost controls are not configured. Live generation is blocked fail-closed. / Chưa cấu hình giới hạn chi phí thử nghiệm. Hệ thống đã chặn tạo kịch bản an toàn.',
        missingOrInvalid: costValidation.missingOrInvalid,
      },
      503,
    );
  }
  const costConfig = costValidation.config;

  const financingMode = resolvePilotFinancingMode(env);
  if (financingMode === 'DISABLED') {
    return jsonPrivate(
      {
        code: 'PILOT_FINANCING_DISABLED',
        error:
          'Pilot AI financing mode is disabled. / Chế độ tài trợ AI cho bản thử nghiệm đang tắt.',
      },
      503,
    );
  }

  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const consent = await getPilotConsent(d1, { orgId: payload.orgId, userId: user.id });
  if (!consent || consent.policyVersion !== PILOT_POLICY_VERSION) {
    return jsonPrivate(
      {
        code: 'PILOT_CONSENT_REQUIRED',
        error:
          'Please accept the beta privacy and pilot terms before generating a script. / Vui lòng đồng ý điều khoản thử nghiệm và quyền riêng tư trước khi tạo kịch bản.',
      },
      403,
    );
  }

  // Single active financing mode: NEVER fall back from customer BYOK to Founder-sponsored key.
  let fundingMode: PilotFundingMode = 'none';
  let resolvedApiKey: string | null = null;
  if (financingMode === 'FOUNDER_SPONSORED') {
    const sponsoredKey = resolvePilotSponsoredOpenRouterKey(env);
    if (sponsoredKey) {
      fundingMode = 'founder_sponsored';
      resolvedApiKey = sponsoredKey;
    }
  } else if (financingMode === 'CUSTOMER_BYOK') {
    const byokKey = deps.lookupOpenRouterByokKey
      ? await deps.lookupOpenRouterByokKey(user.id).catch(() => null)
      : null;
    if (byokKey && byokKey.trim().length >= 10) {
      fundingMode = 'customer_byok';
      resolvedApiKey = byokKey.trim();
    }
  }

  if (!resolvedApiKey || !deps.generateLiveScript) {
    const code =
      financingMode === 'CUSTOMER_BYOK'
        ? 'BYOK_KEY_REQUIRED'
        : 'PILOT_PROVIDER_NOT_CONFIGURED';
    return jsonPrivate(
      {
        code,
        error:
          financingMode === 'CUSTOMER_BYOK'
            ? 'A valid customer OpenRouter API key is required. / Cần khóa API OpenRouter hợp lệ của bạn để tiếp tục.'
            : 'No AI provider key is configured for this pilot. / Chưa cấu hình khóa nhà cung cấp AI cho bản thử nghiệm.',
      },
      financingMode === 'CUSTOMER_BYOK' ? 422 : 503,
    );
  }

  const payloadHash = await computeCreatePayloadHash({
    missionId: payload.missionId,
    topic: payload.topic,
    audience: payload.audience,
    durationSec: payload.durationSec,
    provenance: 'live_provider',
  });

  // Short-circuit idempotent replays BEFORE reserving quota or calling the live AI provider.
  const existing = await findReviewByIdempotencyKey(d1, {
    orgId: payload.orgId,
    userId: user.id,
    idempotencyKey,
  });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return jsonPrivate(
        {
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          error: 'Idempotency key already used with a different payload',
          existingArtifactId: existing.artifactId,
        },
        409,
      );
    }
    const currentQuota = await getPilotQuotaStatus(d1, {
      orgId: payload.orgId,
      userId: user.id,
      maxGenerations: costConfig.maxGenerations,
      maxEstimatedSpendMicroUsd: costConfig.maxEstimatedSpendMicroUsd,
    });
    return jsonPrivate(
      {
        review: existing,
        fundingMode,
        quota: currentQuota,
        idempotentReplay: true,
        publicPublished: false,
        paidInferenceExecuted: false,
      },
      200,
    );
  }

  const reservation = await reservePilotGenerationSlot(d1, {
    orgId: payload.orgId,
    userId: user.id,
    maxGenerations: costConfig.maxGenerations,
    cooldownMs: costConfig.cooldownMs,
    nowMs,
    maxEstimatedSpendMicroUsd: costConfig.maxEstimatedSpendMicroUsd,
    estimatedCostPerAttemptMicroUsd: costConfig.estimatedCostPerAttemptMicroUsd,
    inFlightLockMs: costConfig.inFlightLockMs,
  });

  if (reservation.outcome === 'quota_exceeded') {
    return jsonPrivate(
      {
        code: 'PILOT_QUOTA_EXCEEDED',
        error:
          'You have reached the pilot script generation limit. Please contact support if you need more quota. / Bạn đã đạt giới hạn tạo kịch bản của bản thử nghiệm.',
        quota: reservation.quota,
      },
      429,
    );
  }

  if (reservation.outcome === 'spend_limit_exceeded') {
    return jsonPrivate(
      {
        code: 'PILOT_SPEND_LIMIT_EXCEEDED',
        error:
          'The pilot safety budget cap has been reached. Please contact support to continue. / Đã đạt ngưỡng ngân sách an toàn của bản thử nghiệm. Vui lòng liên hệ hỗ trợ.',
        quota: reservation.quota,
      },
      429,
    );
  }

  if (reservation.outcome === 'in_flight') {
    return jsonPrivate(
      {
        code: 'PILOT_GENERATION_IN_PROGRESS',
        error:
          'A script generation is already in progress. Please wait for it to finish. / Hệ thống đang tạo một kịch bản khác. Vui lòng đợi hoàn tất.',
        retryAfterSec: reservation.retryAfterSec,
        quota: reservation.quota,
      },
      429,
    );
  }

  if (reservation.outcome === 'rate_limited') {
    return jsonPrivate(
      {
        code: 'PILOT_RATE_LIMITED',
        error: `Please wait ${reservation.retryAfterSec}s before generating another script. / Vui lòng đợi ${reservation.retryAfterSec} giây trước khi tạo kịch bản tiếp theo.`,
        retryAfterSec: reservation.retryAfterSec,
        quota: reservation.quota,
      },
      429,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'BRIEF_SUBMITTED',
    metadata: { durationSec: payload.durationSec, fundingMode },
    nowIso,
  });
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'GENERATION_REQUESTED',
    metadata: { fundingMode, modelId: costConfig.modelId },
    nowIso,
  });

  let validatedScript: ScriptOutput;
  try {
    const rawScript = await deps.generateLiveScript({
      topic: payload.topic,
      audience: payload.audience,
      durationSec: payload.durationSec,
      userId: user.id,
      apiKey: resolvedApiKey,
      model: costConfig.modelId,
      maxTokens: costConfig.maxOutputTokens,
      maxRetries: costConfig.maxRetries,
      timeoutMs: costConfig.timeoutMs,
      referer: resolvePilotRefererOrigin(env),
    });
    validatedScript = validateParsedScriptStructure(rawScript, {
      minScenes: 3,
      targetDurationSec: payload.durationSec,
    });
  } catch (err) {
    const isConfirmedPreChargeRejection =
      err instanceof ProviderInvalidKeyError || err instanceof ProviderQuotaExceededError;

    if (isConfirmedPreChargeRejection) {
      await releasePilotGenerationSlot(d1, {
        orgId: payload.orgId,
        userId: user.id,
        nowIso,
        refundEstimatedSpendMicroUsd: costConfig.estimatedCostPerAttemptMicroUsd,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
    } else {
      // Conservative charged-failure accounting: clear concurrency lock but retain
      // quota & estimated spend when the provider may have billed the attempt.
      await clearPilotInFlightLock(d1, {
        orgId: payload.orgId,
        userId: user.id,
        nowIso,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
    }

    const failureCode =
      err instanceof ProviderInvalidKeyError
        ? 'PROVIDER_KEY_INVALID'
        : err instanceof ProviderQuotaExceededError
          ? 'PROVIDER_QUOTA_EXCEEDED'
          : err instanceof InvalidScriptStructureError
            ? 'INVALID_SCRIPT_STRUCTURE'
            : 'PROVIDER_GENERATION_FAILED';

    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'GENERATION_FAILED',
      metadata: {
        failureCode,
        fundingMode,
        quotaRefunded: isConfirmedPreChargeRejection,
      },
      nowIso,
    });

    const status = failureCode === 'PROVIDER_KEY_INVALID' ? 422 : 502;
    const errorMessage =
      failureCode === 'PROVIDER_KEY_INVALID'
        ? 'Your OpenRouter API key is invalid or has been revoked (this attempt did not use your pilot quota). Please click "Replace Key" in Step 1 to enter a valid key. / Khóa API OpenRouter của bạn không hợp lệ hoặc đã bị thu hồi (không trừ lượt tạo thử nghiệm). Vui lòng bấm "Đổi khóa khác" ở mục số 1 để cập nhật khóa mới.'
        : failureCode === 'PROVIDER_QUOTA_EXCEEDED'
          ? 'Your OpenRouter account or API key has run out of credits or reached its spending limit (this attempt did not use your pilot quota). Please top up or adjust your key limit on openrouter.ai and try again. / Tài khoản hoặc khóa OpenRouter của bạn đã hết tín dụng (credit) hoặc chạm giới hạn chi tiêu (không trừ lượt tạo thử nghiệm). Vui lòng nạp thêm hoặc tăng giới hạn khóa tại openrouter.ai rồi thử lại.'
          : 'Script generation failed after submission. To protect pilot budget safety, this attempt remains counted. Please try again. / Tạo kịch bản thất bại sau khi gửi yêu cầu. Để đảm bảo an toàn ngân sách thử nghiệm, lượt này vẫn được tính.';
    return jsonPrivate(
      {
        code: failureCode,
        quotaRefunded: isConfirmedPreChargeRejection,
        error: errorMessage,
      },
      status,
    );
  }

  let result: Awaited<ReturnType<typeof createOrReplayReview>>;
  try {
    result = await createOrReplayReview(d1, {
      artifactId: `fv_${crypto.randomUUID()}`,
      orgId: payload.orgId,
      userId: user.id,
      missionId: payload.missionId,
      idempotencyKey,
      payloadHash,
      provenance: 'live_provider',
      provenanceLabel: getProvenanceLabel('live_provider'),
      topic: payload.topic,
      audience: payload.audience,
      durationSec: payload.durationSec,
      script: validatedScript,
      receiptId: payload.receipt?.receiptId ?? `pilot_${fundingMode}_${nowMs}`,
      mcuAccountingRef: `pilot_free_${fundingMode}`,
      mcuCharged: 0,
      nowIso,
    });
  } catch {
    await clearPilotInFlightLock(d1, {
      orgId: payload.orgId,
      userId: user.id,
      nowIso,
      expectedLockUntilMs: reservation.lockUntilMs,
    }).catch(() => {});
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to persist review artifact' },
      500,
    );
  }

  if (result.outcome === 'idempotency_conflict') {
    await clearPilotInFlightLock(d1, {
      orgId: payload.orgId,
      userId: user.id,
      nowIso,
      expectedLockUntilMs: reservation.lockUntilMs,
    }).catch(() => {});
    return jsonPrivate(
      {
        code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
        error: 'Idempotency key already used with a different payload',
        existingArtifactId: result.existingArtifactId,
      },
      409,
    );
  }

  // Provider call has already executed; release only this request's concurrency lock
  // and retain consumed quota/spend even if a racing duplicate key replayed.
  await clearPilotInFlightLock(d1, {
    orgId: payload.orgId,
    userId: user.id,
    nowIso,
    expectedLockUntilMs: reservation.lockUntilMs,
  }).catch(() => {});
  const finalQuota = reservation.quota;

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'GENERATION_SUCCEEDED',
    artifactId: result.record.artifactId,
    metadata: {
      fundingMode,
      modelId: costConfig.modelId,
      sceneCount: validatedScript.scenes.length,
    },
    nowIso,
  });

  return jsonPrivate(
    {
      review: result.record,
      fundingMode,
      quota: finalQuota,
      idempotentReplay: result.outcome === 'replayed',
      publicPublished: false,
      paidInferenceExecuted: true,
    },
    result.outcome === 'created' ? 201 : 200,
  );
}

export async function handleEditReview(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'edit_review' }>,
  idempotencyHeader: string | null,
  deps: PilotRuntimeDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  let validatedScript: ScriptOutput;
  try {
    validatedScript = validateParsedScriptStructure(payload.script, { minScenes: 3 });
  } catch (err) {
    return jsonPrivate(
      {
        code: 'INVALID_SCRIPT_STRUCTURE',
        error: err instanceof Error ? err.message : 'Script must contain at least 3 valid scenes',
      },
      400,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const res = await updateReviewScript(d1, {
    artifactId: payload.artifactId,
    orgId: payload.orgId,
    userId: user.id,
    expectedVersion: payload.expectedVersion,
    script: validatedScript,
    nowIso,
  });

  if (res.outcome === 'not_found') {
    return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review artifact not found' }, 404);
  }
  if (res.outcome === 'stale_version') {
    return jsonPrivate(
      { code: 'STALE_VERSION', error: 'Stale review version', currentVersion: res.currentVersion },
      409,
    );
  }
  if (res.outcome === 'already_finalized') {
    return jsonPrivate(
      {
        code: 'REVIEW_ALREADY_FINALIZED',
        error: 'Finalized review cannot be edited',
        review: res.record,
      },
      409,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'SCRIPT_EDITED',
    artifactId: res.record.artifactId,
    metadata: { version: res.record.version, sceneCount: validatedScript.scenes.length },
    nowIso,
  });

  return jsonPrivate(
    {
      review: res.record,
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

export async function handleSubmitFeedback(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'submit_feedback' }>,
  deps: PilotRuntimeDeps,
): Promise<NextResponse> {
  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  let feedback: Awaited<ReturnType<typeof recordPilotFeedback>>;
  try {
    feedback = await recordPilotFeedback(d1, {
      orgId: payload.orgId,
      userId: user.id,
      artifactId: payload.artifactId ?? null,
      rating: payload.rating,
      category: payload.category,
      comment: payload.comment,
      screenshotDataUrl: payload.screenshotDataUrl ?? null,
      nowIso,
    });
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to persist customer feedback' },
      500,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'CUSTOMER_FEEDBACK_SUBMITTED',
    artifactId: payload.artifactId ?? null,
    metadata: { rating: payload.rating, category: payload.category },
    nowIso,
  });

  return jsonPrivate(
    {
      feedback,
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    201,
  );
}
