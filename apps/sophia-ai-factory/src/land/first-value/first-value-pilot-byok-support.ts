/**
 * Customer BYOK key management and in-app Support / Data-Deletion actions
 * for the Private Beta First-Value Journey (/api/first-value).
 *
 * Security invariants:
 * - Never echoes or logs raw customer API keys.
 * - Probes OpenRouter behind the service circuit breaker before storing.
 * - Encrypts keys at rest via user-api-key-store (AES-GCM with BYOK_MASTER_KEY).
 * - Persists tenant-isolated support & deletion requests in Cloudflare D1 with receipt IDs.
 *
 * @module land/first-value/first-value-pilot-byok-support
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import type { ProbeResult } from '@/tree/byok/provider-probe';
import { validateOpenRouter } from '@/tree/byok/validators/provider-rules';
import {
  countOpenPilotSupportRequestsForUser,
  createPilotSupportRequest,
} from '@/tree/first-value/pilot-support-repo';
import { jsonPrivate, type FirstValuePostPayload } from './first-value-http-schemas';
import {
  safeRecordPilotEvent,
  type PilotLiveUser,
} from './first-value-pilot-actions';

export interface PilotByokSupportDeps {
  readonly probeOpenRouterByokKey?: (apiKey: string) => Promise<ProbeResult>;
  readonly saveOpenRouterByokKey?: (userId: string, apiKey: string) => Promise<void>;
  readonly clearOpenRouterByokKey?: (userId: string) => Promise<void>;
  readonly nowMs?: () => number;
}

function rejectFailedOpenRouterProbe(probe: ProbeResult, userId: string): NextResponse {
  const isAuthRejection = probe.httpStatus === 401 || probe.httpStatus === 403;
  if (!isAuthRejection) {
    const kind = probe.httpStatus ? classifyHttpStatus(probe.httpStatus) : FailureKind.TIMEOUT;
    recordFailure('openrouter-probe', kind, userId);
  }
  return jsonPrivate(
    {
      code: isAuthRejection ? 'BYOK_KEY_REJECTED' : 'BYOK_PROVIDER_UNREACHABLE',
      error: `${probe.message} / ${probe.message_vi}`,
    },
    isAuthRejection ? 422 : 502,
  );
}

export async function handleSaveByokKey(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'save_byok_key' }>,
  deps: PilotByokSupportDeps,
): Promise<NextResponse> {
  const formatResult = validateOpenRouter(payload.apiKey);
  if (!formatResult.ok) {
    return jsonPrivate(
      {
        code: 'BYOK_INVALID_FORMAT',
        error:
          'Invalid OpenRouter API key format (expected sk-or-...). / Định dạng khóa OpenRouter không hợp lệ (cần bắt đầu bằng sk-or-...).',
      },
      400,
    );
  }

  if (!deps.probeOpenRouterByokKey || !deps.saveOpenRouterByokKey) {
    return jsonPrivate(
      {
        code: 'BYOK_STORAGE_UNAVAILABLE',
        error:
          'Customer API key storage is currently unavailable. / Kho lưu trữ khóa API tạm thời không khả dụng.',
      },
      503,
    );
  }

  if (!shouldAllowRequest('openrouter-probe', user.id)) {
    return jsonPrivate(
      {
        code: 'BYOK_PROBE_COOLDOWN',
        error:
          'OpenRouter verification is cooling down after upstream errors. Please try again in a minute. / Hệ thống xác thực OpenRouter đang tạm nghỉ sau lỗi kết nối, vui lòng thử lại sau ít phút.',
      },
      503,
    );
  }

  const trimmedKey = payload.apiKey.trim();
  let probe: ProbeResult;
  try {
    probe = await deps.probeOpenRouterByokKey(trimmedKey);
  } catch {
    recordFailure('openrouter-probe', FailureKind.NETWORK, user.id);
    return jsonPrivate(
      {
        code: 'BYOK_PROVIDER_UNREACHABLE',
        error:
          'Unable to verify key with OpenRouter right now. Please try again. / Không thể kết nối tới OpenRouter để xác thực khóa lúc này.',
      },
      502,
    );
  }

  if (!probe.ok || !probe.valid) {
    return rejectFailedOpenRouterProbe(probe, user.id);
  }

  recordSuccess('openrouter-probe', user.id);
  recordSuccess('openrouter', user.id);
  recordSuccess('openrouter');

  try {
    await deps.saveOpenRouterByokKey(user.id, trimmedKey);
  } catch {
    return jsonPrivate(
      {
        code: 'STORAGE_WRITE_FAILED',
        error:
          'Failed to encrypt and store your OpenRouter API key. / Không thể mã hóa và lưu khóa API OpenRouter của bạn.',
      },
      500,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'BYOK_KEY_SAVED',
    metadata: { provider: 'openrouter', maskedKey: probe.maskedKey },
    nowIso,
  });

  return jsonPrivate(
    {
      byokConfigured: true,
      byok: {
        provider: 'openrouter',
        configured: true,
        verified: true,
        maskedKey: probe.maskedKey,
      },
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

export async function handleClearByokKey(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'clear_byok_key' }>,
  deps: PilotByokSupportDeps,
): Promise<NextResponse> {
  if (!deps.clearOpenRouterByokKey) {
    return jsonPrivate(
      { code: 'BYOK_STORAGE_UNAVAILABLE', error: 'Customer API key storage is unavailable' },
      503,
    );
  }

  try {
    await deps.clearOpenRouterByokKey(user.id);
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to remove stored OpenRouter API key' },
      500,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'BYOK_KEY_CLEARED',
    metadata: { provider: 'openrouter' },
    nowIso,
  });

  return jsonPrivate(
    {
      byokConfigured: false,
      byok: { provider: 'openrouter', configured: false },
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

const MAX_OPEN_PILOT_SUPPORT_REQUESTS = 20;

export async function handleSubmitSupportRequest(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'submit_support_request' }>,
  deps: PilotByokSupportDeps,
): Promise<NextResponse> {
  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  let created: Awaited<ReturnType<typeof createPilotSupportRequest>>;
  try {
    const openCount = await countOpenPilotSupportRequestsForUser(d1, {
      orgId: payload.orgId,
      userId: user.id,
    });
    if (openCount >= MAX_OPEN_PILOT_SUPPORT_REQUESTS) {
      return jsonPrivate(
        {
          code: 'SUPPORT_QUEUE_LIMIT_REACHED',
          error:
            'Maximum open support requests reached (20). / Đã đạt giới hạn 20 yêu cầu hỗ trợ đang mở.',
        },
        429,
      );
    }
    created = await createPilotSupportRequest(d1, {
      orgId: payload.orgId,
      userId: user.id,
      requestType: payload.requestType,
      subject: payload.subject,
      message: payload.message,
      nowIso,
    });
  } catch {
    return jsonPrivate(
      {
        code: 'STORAGE_WRITE_FAILED',
        error:
          'Failed to record your support request. Please try again. / Không thể ghi nhận yêu cầu hỗ trợ, vui lòng thử lại.',
      },
      500,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName:
      payload.requestType === 'data_deletion'
        ? 'DATA_DELETION_REQUESTED'
        : 'SUPPORT_REQUEST_SUBMITTED',
    metadata: { requestId: created.id, requestType: created.requestType },
    nowIso,
  });

  return jsonPrivate(
    {
      supportRequest: {
        id: created.id,
        requestType: created.requestType,
        subject: created.subject,
        status: created.status,
        createdAtIso: created.createdAtIso,
        updatedAtIso: created.updatedAtIso,
        resolvedAtIso: created.resolvedAtIso,
      },
      acknowledgment: {
        requestId: created.id,
        requestType: created.requestType,
        status: created.status,
        submittedAtIso: created.createdAtIso,
        slaHours: 72,
      },
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    201,
  );
}
