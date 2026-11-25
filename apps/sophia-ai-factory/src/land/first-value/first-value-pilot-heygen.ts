/**
 * Optional HeyGen BYOK key management & customer-funded MP4 avatar render/poll handlers
 * for the Private Beta First-Value Journey (/api/first-value).
 *
 * Enforces `(org_id, user_id)` ownership on `artifactId` and `shortCode`, derives
 * `referralUrl` server-side from `resolvePilotRefererOrigin`, and isolates circuit breakers per user.
 *
 * @module land/first-value/first-value-pilot-heygen
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import {
  isPilotInviteOnlyEnabled,
  PILOT_POLICY_VERSION,
  resolvePilotRefererOrigin,
  type PilotEnvSource,
} from '@/seed/pilot/pilot-access-policy';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import type { ProbeResult } from '@/tree/byok/provider-probe';
import { validateHeyGen } from '@/tree/byok/validators/provider-rules';
import { getReviewById } from '@/tree/first-value/first-value-review-repo';
import {
  getPilotAffiliateLinkByCodeForUser,
  getPilotMp4ExportByIdForUser,
  listPilotMp4Exports,
  recordPilotMp4Export,
  updatePilotMp4ExportStatus,
} from '@/tree/first-value/pilot-commercial-repo';
import { getPilotConsent } from '@/tree/first-value/pilot-state-repo';
import { assertSafeHeyGenMediaUrl } from './pilot-heygen-byok-client';
import { jsonPrivate, type FirstValuePostPayload } from './first-value-http-schemas';
import { safeRecordPilotEvent, type PilotLiveUser } from './first-value-pilot-actions';

export async function enforcePilotCommercialConsentGuard(
  d1: D1Database,
  orgId: string,
  userId: string,
  env: PilotEnvSource = process.env,
): Promise<NextResponse | null> {
  if (!isPilotInviteOnlyEnabled(env)) {
    return null;
  }
  const consent = await getPilotConsent(d1, { orgId, userId }).catch(() => null);
  if (!consent || consent.policyVersion !== PILOT_POLICY_VERSION) {
    return jsonPrivate(
      {
        code: 'PILOT_CONSENT_REQUIRED',
        error:
          'Please accept the Private Beta terms & privacy notice before continuing. / Vui lòng đồng ý điều khoản & quyền riêng tư trước khi thao tác.',
      },
      403,
    );
  }
  return null;
}

export interface PilotCommercialDeps {
  readonly env?: PilotEnvSource;
  readonly nowMs?: () => number;
  readonly lookupHeyGenByokKey?: (userId: string) => Promise<string | null>;
  readonly probeHeyGenByokKey?: (apiKey: string) => Promise<ProbeResult>;
  readonly saveHeyGenByokKey?: (userId: string, apiKey: string) => Promise<void>;
  readonly clearHeyGenByokKey?: (userId: string) => Promise<void>;
  readonly submitHeyGenVideo?: (input: {
    readonly userId?: string;
    readonly apiKey: string;
    readonly script: string;
    readonly title: string;
  }) => Promise<{ readonly videoId: string }>;
  readonly fetchHeyGenVideoStatus?: (input: {
    readonly userId?: string;
    readonly apiKey: string;
    readonly videoId: string;
  }) => Promise<{
    readonly status: 'processing' | 'completed' | 'failed';
    readonly mediaUrl?: string;
    readonly durationSec?: number;
    readonly errorMessage?: string;
  }>;
}

export async function handleSaveHeyGenByokKey(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'save_byok_key' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const consentBlocked = await enforcePilotCommercialConsentGuard(
    d1,
    payload.orgId,
    user.id,
    deps.env,
  );
  if (consentBlocked) return consentBlocked;

  if (!validateHeyGen(payload.apiKey).ok) {
    return jsonPrivate(
      { code: 'BYOK_INVALID_FORMAT', error: 'Invalid HeyGen API key format. / Định dạng khóa API HeyGen không hợp lệ.' },
      400,
    );
  }
  if (!deps.probeHeyGenByokKey || !deps.saveHeyGenByokKey) {
    return jsonPrivate({ code: 'BYOK_STORAGE_UNAVAILABLE', error: 'HeyGen BYOK storage unavailable' }, 503);
  }
  if (!shouldAllowRequest('heygen-probe', user.id)) {
    return jsonPrivate({ code: 'BYOK_PROBE_COOLDOWN', error: 'HeyGen verification cooling down, retry shortly.' }, 503);
  }

  const trimmedKey = payload.apiKey.trim();
  let probe: ProbeResult;
  try {
    probe = await deps.probeHeyGenByokKey(trimmedKey);
  } catch {
    recordFailure('heygen-probe', FailureKind.NETWORK, user.id);
    return jsonPrivate({ code: 'BYOK_PROVIDER_UNREACHABLE', error: 'Unable to verify key with HeyGen right now.' }, 502);
  }

  if (!probe.ok || !probe.valid) {
    const isAuth = probe.httpStatus === 401 || probe.httpStatus === 403;
    const isCredit = probe.httpStatus === 402;
    if (!isAuth && !isCredit) {
      recordFailure('heygen-probe', probe.httpStatus ? classifyHttpStatus(probe.httpStatus) : FailureKind.TIMEOUT, user.id);
    }
    return jsonPrivate(
      {
        code: isAuth ? 'BYOK_KEY_REJECTED' : isCredit ? 'BYOK_KEY_QUOTA_EXCEEDED' : 'BYOK_PROVIDER_UNREACHABLE',
        error: `${probe.message} / ${probe.message_vi}`,
      },
      isAuth || isCredit ? 422 : 502,
    );
  }

  recordSuccess('heygen-probe', user.id);
  try {
    await deps.saveHeyGenByokKey(user.id, trimmedKey);
  } catch {
    return jsonPrivate({ code: 'STORAGE_WRITE_FAILED', error: 'Failed to encrypt and save HeyGen BYOK key' }, 500);
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'HEYGEN_BYOK_SAVED',
    metadata: { provider: 'heygen', maskedKey: probe.maskedKey },
    nowIso,
  });
  return jsonPrivate(
    { heygenByokConfigured: true, byok: { provider: 'heygen', configured: true, verified: true, maskedKey: probe.maskedKey }, publicPublished: false, paidInferenceExecuted: false },
    200,
  );
}

export async function handleClearHeyGenByokKey(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'clear_byok_key' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  if (!deps.clearHeyGenByokKey) {
    return jsonPrivate({ code: 'BYOK_STORAGE_UNAVAILABLE', error: 'HeyGen BYOK storage unavailable' }, 503);
  }
  try {
    await deps.clearHeyGenByokKey(user.id);
  } catch {
    return jsonPrivate({ code: 'STORAGE_WRITE_FAILED', error: 'Failed to clear HeyGen BYOK key' }, 500);
  }
  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'HEYGEN_BYOK_CLEARED',
    metadata: { provider: 'heygen' },
    nowIso,
  });
  return jsonPrivate({ heygenByokConfigured: false, byok: { provider: 'heygen', configured: false }, publicPublished: false, paidInferenceExecuted: false }, 200);
}

export async function handleSubmitHeyGenMp4(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'submit_heygen_mp4' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const consentBlocked = await enforcePilotCommercialConsentGuard(
    d1,
    payload.orgId,
    user.id,
    deps.env,
  );
  if (consentBlocked) return consentBlocked;

  const baseOrigin = resolvePilotRefererOrigin(deps.env ?? process.env);
  const ownedLink = await getPilotAffiliateLinkByCodeForUser(d1, {
    orgId: payload.orgId,
    userId: user.id,
    shortCode: payload.shortCode,
    baseOrigin,
  });
  if (!ownedLink) {
    return jsonPrivate({ code: 'SHORTLINK_NOT_FOUND', error: 'Create your pilot referral shortlink first' }, 404);
  }

  const review = await getReviewById(d1, { artifactId: payload.artifactId, orgId: payload.orgId, userId: user.id });
  if (!review || review.reviewState !== 'accepted') {
    return jsonPrivate(
      { code: review ? 'SCRIPT_NOT_ACCEPTED' : 'ARTIFACT_NOT_FOUND', error: review ? 'Accept the script first' : 'Review artifact not found' },
      review ? 409 : 404,
    );
  }

  // Deduplicate in-flight HeyGen renders on the same artifact so double-clicks never burn customer credits twice
  const existingExports = await listPilotMp4Exports(d1, { orgId: payload.orgId, userId: user.id });
  const inFlight = existingExports.find(
    (e) => e.artifactId === review.artifactId && e.renderMode === 'heygen_byok_mp4' && e.status === 'processing',
  );
  if (inFlight) {
    return jsonPrivate(
      { mp4Export: inFlight, inFlightDeduplicated: true, publicPublished: false, paidInferenceExecuted: false },
      200,
    );
  }

  const heygenKey = deps.lookupHeyGenByokKey ? await deps.lookupHeyGenByokKey(user.id) : null;
  if (!heygenKey || !deps.submitHeyGenVideo) {
    return jsonPrivate({ code: 'HEYGEN_BYOK_REQUIRED', error: 'Save your HeyGen BYOK key first or use 1-Key Browser MP4.' }, 422);
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const fullNarration = [...review.script.scenes.map((s) => s.narration), `${ownedLink.ctaText}. ${ownedLink.shortUrl}`].join(' ');
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'MP4_EXPORT_REQUESTED',
    artifactId: review.artifactId,
    metadata: { renderMode: 'heygen_byok_mp4', shortCode: ownedLink.shortCode },
    nowIso,
  });

  try {
    const submitted = await deps.submitHeyGenVideo({
      userId: user.id,
      apiKey: heygenKey,
      script: fullNarration.slice(0, 4000),
      title: review.script.title,
    });
    const mp4Export = await recordPilotMp4Export(d1, {
      orgId: payload.orgId,
      userId: user.id,
      artifactId: review.artifactId,
      renderMode: 'heygen_byok_mp4',
      heygenJobId: submitted.videoId,
      status: 'processing',
      ctaText: ownedLink.ctaText,
      shortCode: ownedLink.shortCode,
      referralUrl: ownedLink.shortUrl,
      nowIso,
    });
    return jsonPrivate({ mp4Export, publicPublished: false, paidInferenceExecuted: true }, 202);
  } catch {
    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'MP4_EXPORT_FAILED',
      artifactId: review.artifactId,
      metadata: { renderMode: 'heygen_byok_mp4', errorCode: 'HEYGEN_SUBMIT_FAILED' },
      nowIso,
    });
    return jsonPrivate({ code: 'HEYGEN_SUBMIT_FAILED', error: 'HeyGen rejected the render request. Check your HeyGen credits/key or use 1-Key Browser MP4.' }, 502);
  }
}

export async function handlePollHeyGenMp4(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'poll_heygen_mp4' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const target = await getPilotMp4ExportByIdForUser(d1, {
    orgId: payload.orgId,
    userId: user.id,
    exportId: payload.exportId,
  });
  if (!target || !target.heygenJobId) {
    return jsonPrivate({ code: 'EXPORT_NOT_FOUND', error: 'HeyGen export job not found' }, 404);
  }
  if (target.status === 'completed' || target.status === 'failed') {
    return jsonPrivate({ mp4Export: target, publicPublished: false, paidInferenceExecuted: false }, 200);
  }

  const heygenKey = deps.lookupHeyGenByokKey ? await deps.lookupHeyGenByokKey(user.id) : null;
  if (!heygenKey || !deps.fetchHeyGenVideoStatus) {
    return jsonPrivate({ code: 'HEYGEN_BYOK_REQUIRED', error: 'HeyGen BYOK key required' }, 422);
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  try {
    const statusRes = await deps.fetchHeyGenVideoStatus({
      userId: user.id,
      apiKey: heygenKey,
      videoId: target.heygenJobId,
    });
    if (statusRes.status === 'completed' && statusRes.mediaUrl) {
      const safeMediaUrl = assertSafeHeyGenMediaUrl(statusRes.mediaUrl).toString();
      const updated = await updatePilotMp4ExportStatus(d1, {
        id: target.id,
        orgId: payload.orgId,
        userId: user.id,
        status: 'completed',
        providerVideoUrl: safeMediaUrl,
        durationSec: statusRes.durationSec ?? null,
        nowIso,
      });
      await safeRecordPilotEvent(d1, {
        orgId: payload.orgId,
        userId: user.id,
        eventName: 'MP4_EXPORTED',
        artifactId: target.artifactId,
        metadata: { exportId: target.id, renderMode: 'heygen_byok_mp4' },
        nowIso,
      });
      return jsonPrivate({ mp4Export: updated ?? target, publicPublished: false, paidInferenceExecuted: false }, 200);
    }
    if (statusRes.status === 'failed') {
      const updated = await updatePilotMp4ExportStatus(d1, {
        id: target.id,
        orgId: payload.orgId,
        userId: user.id,
        status: 'failed',
        errorCode: 'HEYGEN_RENDER_FAILED',
        nowIso,
      });
      await safeRecordPilotEvent(d1, {
        orgId: payload.orgId,
        userId: user.id,
        eventName: 'MP4_EXPORT_FAILED',
        artifactId: target.artifactId,
        metadata: { exportId: target.id, renderMode: 'heygen_byok_mp4', errorCode: 'HEYGEN_RENDER_FAILED' },
        nowIso,
      });
      return jsonPrivate({ mp4Export: updated ?? target, publicPublished: false, paidInferenceExecuted: false }, 200);
    }
    return jsonPrivate({ mp4Export: target, publicPublished: false, paidInferenceExecuted: false }, 200);
  } catch {
    return jsonPrivate({ code: 'HEYGEN_POLL_FAILED', error: 'Unable to poll HeyGen status right now' }, 502);
  }
}
