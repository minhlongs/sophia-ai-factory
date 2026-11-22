/**
 * Durable HTTP handler for /api/first-value (Track B1.1).
 *
 * Backs all review state, idempotency, and private exports with Cloudflare D1.
 * Enforces authentication, workspace authorization, CSRF protection,
 * HMAC validation receipts, zero-MCU simulated fixtures, and zero live inference.
 *
 * @module land/first-value/first-value-http-handler
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextRequest, NextResponse } from 'next/server';
import { buildFirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import { selectModelForTier } from '@/seed/ai/script-generator';
import { csrfForbiddenResponse } from '@/seed/security/csrf';
import {
  createHonestValidationReceipt,
  verifyHonestValidationReceipt,
  type HonestValidationReceipt,
} from '@/tree/byok/honest-validation-receipt';
import {
  buildDeterministicFixtureScript,
  getProvenanceLabel,
  renderFirstValueMarkdown,
  type FirstValueScriptArtifact,
} from '@/tree/first-value/first-value-contract';
import {
  computeCreatePayloadHash,
  createOrReplayReview,
  getReviewById,
  listReviewsForOrg,
  transitionReviewState,
  type DurableFirstValueReview,
} from '@/tree/first-value/first-value-review-repo';
import {
  executeWithMcuAuthorization,
  FIXTURE_ZERO_MCU_ACCOUNTING_REF,
} from '@/tree/first-value/mcu-authorization-contract';
import {
  FirstValuePostSchema,
  jsonPrivate,
  resolveIdempotencyKey,
  type FirstValuePostPayload,
} from './first-value-http-schemas';

export interface FirstValueHttpUser {
  readonly id: string;
  readonly email?: string | null;
}

export interface FirstValueHttpDeps {
  readonly getD1: () => Promise<D1Database | null>;
  readonly getCurrentUser: () => Promise<FirstValueHttpUser | null>;
  readonly verifyWorkspaceAccess: (orgId: string, userId: string) => Promise<boolean>;
  readonly verifyCsrf: (request: NextRequest) => boolean;
  readonly listByokProviders: (userId: string) => Promise<readonly string[]>;
  readonly signingSecret: string | null;
  readonly nowMs?: () => number;
}

function toContractArtifact(rec: DurableFirstValueReview): FirstValueScriptArtifact {
  return {
    artifactId: rec.artifactId,
    sessionId: rec.missionId,
    userId: rec.userId,
    orgId: rec.orgId,
    version: rec.version,
    idempotencyKey: rec.idempotencyKey,
    topic: rec.topic,
    audience: rec.audience,
    durationSec: rec.durationSec,
    provenance: rec.provenance,
    provenanceLabel: rec.provenanceLabel,
    script: rec.script,
    reviewState: rec.reviewState,
    acceptedAtIso: rec.acceptedAtIso,
    acceptedByUserId: rec.acceptedByUserId,
    rejectedAtIso: rec.rejectedAtIso,
    rejectionReason: rec.rejectionReason,
    publicPublished: false,
    mcuCharged: rec.mcuCharged,
    optionalNotificationDelivered: false,
    createdAtIso: rec.createdAtIso,
  };
}

/**
 * Strictly read-only GET handler (zero DB writes).
 * Supports `GET /api/first-value?orgId=...&artifactId=...` (`get_review`)
 * and `GET /api/first-value?orgId=...` (status + honest receipt + recent reviews).
 */
export async function handleFirstValueGet(
  request: NextRequest,
  deps: FirstValueHttpDeps,
): Promise<NextResponse> {
  const user = await deps.getCurrentUser();
  if (!user) {
    return jsonPrivate({ error: 'Unauthorized / Bạn cần đăng nhập' }, 401);
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  const artifactId = url.searchParams.get('artifactId')?.trim() ?? '';

  if (!orgId) {
    return jsonPrivate({ error: 'orgId query parameter is required' }, 400);
  }

  const hasAccess = await deps.verifyWorkspaceAccess(orgId, user.id);
  if (!hasAccess) {
    return jsonPrivate({ error: 'Organization access denied' }, 403);
  }

  const d1 = await deps.getD1();
  if (!d1) {
    return jsonPrivate({ error: 'Durable storage unavailable' }, 503);
  }

  if (artifactId) {
    const review = await getReviewById(d1, { artifactId, orgId, userId: user.id });
    if (!review) {
      return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review artifact not found' }, 404);
    }
    return jsonPrivate(
      {
        review,
        publicPublished: false,
        paidInferenceExecuted: false,
      },
      200,
    );
  }

  const providers = await deps.listByokProviders(user.id).catch(() => [] as readonly string[]);
  const recentReviews = await listReviewsForOrg(d1, { orgId, userId: user.id, limit: 10 });
  const nowUnix = Math.floor((deps.nowMs ? deps.nowMs() : Date.now()) / 1000);

  let receipt: HonestValidationReceipt | null = null;
  if (providers.length > 0 && deps.signingSecret) {
    receipt = await createHonestValidationReceipt({
      userId: user.id,
      orgId,
      provider: providers[0],
      maskedKey: 'stored:encrypted',
      keyFormatAccepted: true,
      keyStoredSecurely: true,
      providerAuthStatus: 'untested',
      policyStatus: 'found',
      costBasis: 'estimated',
      nowUnix,
      signingSecret: deps.signingSecret,
    });
  }

  return jsonPrivate(
    {
      orgId,
      byokConfigured: providers.length > 0,
      configuredProviders: providers,
      receipt,
      recentReviews,
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

async function handleCreateReview(
  d1: D1Database,
  user: FirstValueHttpUser,
  payload: Extract<FirstValuePostPayload, { action: 'create_review' }>,
  idempotencyHeader: string | null,
  deps: FirstValueHttpDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  if (payload.provenance === 'live_provider') {
    return jsonPrivate(
      { code: 'LIVE_INFERENCE_DISABLED', error: 'Live provider inference is disabled in B1.1' },
      403,
    );
  }

  if (!deps.signingSecret) {
    return jsonPrivate({ code: 'RECEIPT_SIGNING_UNAVAILABLE', error: 'Receipt signing unavailable' }, 503);
  }

  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
  const nowUnix = Math.floor(nowMs / 1000);
  if (payload.receipt.checkedAtUnix > nowUnix + 60) {
    return jsonPrivate(
      {
        code: 'INVALID_OR_EXPIRED_RECEIPT',
        reason: 'RECEIPT_FUTURE_DATED',
        error: 'Validation receipt timestamp is in the future',
      },
      403,
    );
  }
  const receiptCheck = await verifyHonestValidationReceipt(
    payload.receipt as unknown as HonestValidationReceipt,
    {
      userId: user.id,
      orgId: payload.orgId,
      signingSecret: deps.signingSecret,
      maxAgeSec: 900,
      nowUnix,
    },
  );
  if (!receiptCheck.valid) {
    return jsonPrivate(
      {
        code: 'INVALID_OR_EXPIRED_RECEIPT',
        reason: receiptCheck.reason,
        error: 'Validation receipt is invalid, expired, or tampered',
      },
      403,
    );
  }

  const execution = await executeWithMcuAuthorization({
    provenance: 'fixture_simulated',
    orgId: payload.orgId,
    userId: user.id,
    missionId: payload.missionId,
    idempotencyKey: idem.key,
    requiredMcu: 0,
    liveInferenceEnabled: false,
    providerAuthorized: false,
    runFixture: async () =>
      buildDeterministicFixtureScript(payload.topic, payload.audience, payload.durationSec),
  });

  if (!execution.ok) {
    return jsonPrivate({ code: execution.code, error: execution.error }, 403);
  }

  const payloadHash = await computeCreatePayloadHash({
    missionId: payload.missionId,
    topic: payload.topic,
    audience: payload.audience,
    durationSec: payload.durationSec,
    provenance: 'fixture_simulated',
  });

  try {
    const result = await createOrReplayReview(d1, {
      artifactId: `fv_${crypto.randomUUID()}`,
      orgId: payload.orgId,
      userId: user.id,
      missionId: payload.missionId,
      idempotencyKey: idem.key,
      payloadHash,
      provenance: 'fixture_simulated',
      provenanceLabel: getProvenanceLabel('fixture_simulated'),
      topic: payload.topic,
      audience: payload.audience,
      durationSec: payload.durationSec,
      script: execution.output,
      receiptId: payload.receipt.receiptId,
      mcuAccountingRef: FIXTURE_ZERO_MCU_ACCOUNTING_REF,
      mcuCharged: 0,
      nowIso: new Date(nowMs).toISOString(),
    });

    if (result.outcome === 'idempotency_conflict') {
      return jsonPrivate(
        {
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          error: 'Idempotency key already used with a different payload',
          existingArtifactId: result.existingArtifactId,
        },
        409,
      );
    }

    return jsonPrivate(
      {
        review: result.record,
        idempotentReplay: result.outcome === 'replayed',
        publicPublished: false,
        paidInferenceExecuted: false,
      },
      result.outcome === 'created' ? 201 : 200,
    );
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to persist review artifact' },
      500,
    );
  }
}

async function handleTransitionAction(
  d1: D1Database,
  user: FirstValueHttpUser,
  payload: Extract<FirstValuePostPayload, { action: 'accept_review' | 'reject_review' }>,
  idempotencyHeader: string | null,
  deps: FirstValueHttpDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const res = await transitionReviewState(d1, {
    artifactId: payload.artifactId,
    orgId: payload.orgId,
    userId: user.id,
    expectedVersion: payload.expectedVersion,
    decision: payload.action === 'accept_review' ? 'accept' : 'reject',
    reason: payload.action === 'reject_review' ? payload.reason : undefined,
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
        error: 'Finalized review cannot be modified',
        review: res.record,
      },
      409,
    );
  }

  return jsonPrivate(
    {
      review: res.record,
      idempotentReplay: res.outcome === 'already_accepted',
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

async function handlePrivateExport(
  d1: D1Database,
  user: FirstValueHttpUser,
  payload: Extract<FirstValuePostPayload, { action: 'private_export' }>,
  idempotencyHeader: string | null,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const review = await getReviewById(d1, {
    artifactId: payload.artifactId,
    orgId: payload.orgId,
    userId: user.id,
  });

  if (!review) {
    return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review artifact not found' }, 404);
  }

  if (review.reviewState !== 'accepted') {
    return jsonPrivate(
      {
        code: 'SCRIPT_NOT_ACCEPTED',
        error: 'Private export requires an explicitly accepted review',
        reviewState: review.reviewState,
      },
      409,
    );
  }

  const content =
    payload.format === 'markdown'
      ? renderFirstValueMarkdown(toContractArtifact(review))
      : review.script;

  return jsonPrivate(
    {
      export: {
        artifactId: review.artifactId,
        orgId: review.orgId,
        version: review.version,
        privateArtifactRef: review.privateArtifactRef,
        provenance: review.provenance,
        provenanceLabel: review.provenanceLabel,
        reviewState: review.reviewState,
        publicPublished: false,
        cacheControl: 'private, no-store',
        format: payload.format,
        content,
      },
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

function handleStatelessPreviewAction(data: FirstValuePostPayload): NextResponse | null {
  if (data.action === 'cost_preview') {
    const provider = data.provider === undefined ? 'openrouter' : data.provider;
    const model = data.model === undefined ? selectModelForTier('BASIC') : data.model;
    const preview = buildFirstValueCostPreview({
      provider,
      model,
      topic: data.topic,
      audience: data.audience,
      durationSec: data.durationSec,
      capabilitiesKnown: 'inferred_from_provider_table',
    });
    return jsonPrivate(
      { orgId: data.orgId, preview, publicPublished: false, paidInferenceExecuted: false },
      200,
    );
  }
  if (data.action === 'fixture_preview') {
    const script = buildDeterministicFixtureScript(data.topic, data.audience, data.durationSec);
    return jsonPrivate(
      {
        orgId: data.orgId,
        provenance: 'fixture_simulated',
        provenanceLabel: getProvenanceLabel('fixture_simulated'),
        reviewState: 'pending_review',
        publicPublished: false,
        paidInferenceExecuted: false,
        script,
      },
      200,
    );
  }
  return null;
}

async function dispatchDurableAction(
  d1: D1Database,
  user: FirstValueHttpUser,
  data: Exclude<FirstValuePostPayload, { action: 'cost_preview' | 'fixture_preview' }>,
  idempotencyHeader: string | null,
  deps: FirstValueHttpDeps,
): Promise<NextResponse> {
  if (data.action === 'get_review') {
    const review = await getReviewById(d1, {
      artifactId: data.artifactId,
      orgId: data.orgId,
      userId: user.id,
    });
    if (!review) {
      return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review artifact not found' }, 404);
    }
    return jsonPrivate({ review, publicPublished: false, paidInferenceExecuted: false }, 200);
  }
  if (data.action === 'create_review') {
    return handleCreateReview(d1, user, data, idempotencyHeader, deps);
  }
  if (data.action === 'accept_review' || data.action === 'reject_review') {
    return handleTransitionAction(d1, user, data, idempotencyHeader, deps);
  }
  return handlePrivateExport(d1, user, data, idempotencyHeader);
}

export async function handleFirstValuePost(
  request: NextRequest,
  deps: FirstValueHttpDeps,
): Promise<NextResponse> {
  const user = await deps.getCurrentUser();
  if (!user) {
    return jsonPrivate({ error: 'Unauthorized / Bạn cần đăng nhập' }, 401);
  }

  if (!deps.verifyCsrf(request)) {
    const forbidden = csrfForbiddenResponse();
    forbidden.headers.set('Cache-Control', 'private, no-store');
    return forbidden;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: 'Invalid JSON body / Dữ liệu JSON không hợp lệ' }, 400);
  }

  const parsed = FirstValuePostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonPrivate(
      {
        error: 'Validation failed / Dữ liệu không hợp lệ',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const hasAccess = await deps.verifyWorkspaceAccess(parsed.data.orgId, user.id);
  if (!hasAccess) {
    return jsonPrivate(
      { error: 'Organization access denied / Không có quyền truy cập tổ chức này' },
      403,
    );
  }

  const previewResponse = handleStatelessPreviewAction(parsed.data);
  if (previewResponse) {
    return previewResponse;
  }

  const d1 = await deps.getD1();
  if (!d1) {
    return jsonPrivate({ error: 'Durable storage unavailable' }, 503);
  }

  return dispatchDurableAction(
    d1,
    user,
    parsed.data as Exclude<FirstValuePostPayload, { action: 'cost_preview' | 'fixture_preview' }>,
    request.headers.get('idempotency-key'),
    deps,
  );
}
