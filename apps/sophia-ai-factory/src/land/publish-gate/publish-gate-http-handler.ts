/**
 * Compliance Publish Gate — Dependency-Injected HTTP Handler (GET & POST).
 *
 * Security invariants:
 * - Feature flag `FEATURE_B2_COMPLIANCE_PUBLISH_GATE` checked per request; fail-closed 404.
 * - Authenticated session required (401); workspace membership verified (403).
 * - CSRF verified on every mutating POST (403).
 * - GET is strictly read-only (`Cache-Control: private, no-store`).
 * - Zero external network calls; `publicationMode` locked to `MOCK_ONLY`.
 *
 * Layer: land (API route orchestration).
 * @module land/publish-gate/publish-gate-http-handler
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getMockPublishGateAdapter } from '@/tree/publish-gate/platform-adapter';
import {
  createOrReplayPublishGateRequest,
  getPublishGateById,
  listPublishGateAuditEvents,
  listPublishGatesForOrg,
  recordPreflightOutcomeAtomic,
  submitForHumanApprovalAtomic,
} from '@/tree/publish-gate/publish-gate-repo';
import type { PublishGateRecord } from '@/tree/publish-gate/types';
import {
  handleApprovalDecisionAction,
  handleExecuteMockAction,
  handleMutateAndReconcileActions,
  type ActionContext,
} from './publish-gate-http-actions';
import {
  jsonPrivate,
  publishGatePostActionSchema,
  toCanonicalPayload,
} from './publish-gate-http-schemas';

const APPROVAL_WINDOW_MS = 72 * 60 * 60 * 1000;

function sanitizeRecordForCaller(
  record: PublishGateRecord,
  isAdmin: boolean,
): PublishGateRecord {
  if (isAdmin || record.approvalNonce === null) {
    return record;
  }
  return { ...record, approvalNonce: null };
}

export interface PublishGateHttpUser {
  readonly id: string;
  readonly orgId: string;
}

export interface PublishGateHttpDeps {
  readonly isFeatureEnabled: () => boolean;
  readonly getD1: () => Promise<D1Database | null>;
  readonly getCurrentUser: () => Promise<PublishGateHttpUser | null>;
  readonly resolveUserOrgId?: (userId: string, d1: D1Database) => Promise<string | null>;
  readonly verifyWorkspaceAccess: (userId: string, orgId: string, d1: D1Database) => Promise<boolean>;
  readonly verifyWorkspaceWriteRole?: (userId: string, orgId: string, d1: D1Database) => Promise<boolean>;
  readonly verifyWorkspaceAdminRole: (userId: string, orgId: string, d1: D1Database) => Promise<boolean>;
  readonly verifyCsrf: (req: Request) => Promise<boolean>;
  readonly nowMs?: () => number;
  readonly emitGateRequested?: (data: {
    readonly requestId: string;
    readonly orgId: string;
    readonly campaignId: string;
    readonly platform: 'tiktok' | 'youtube' | 'instagram';
    readonly payloadDigestSha256: string;
    readonly approvalVersion: number;
    readonly publicationMode: 'MOCK_ONLY';
  }) => Promise<void>;
  readonly emitHumanApproved?: ActionContext['emitHumanApproved'];
}

export async function handlePublishGateGet(
  req: Request,
  deps: PublishGateHttpDeps,
): Promise<Response> {
  if (!deps.isFeatureEnabled()) {
    return jsonPrivate({ error: 'FEATURE_DISABLED' }, 404);
  }
  const user = await deps.getCurrentUser();
  if (!user) {
    return jsonPrivate({ error: 'UNAUTHORIZED' }, 401);
  }
  const d1 = await deps.getD1();
  if (!d1) {
    return jsonPrivate({ error: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const orgId = deps.resolveUserOrgId
    ? (await deps.resolveUserOrgId(user.id, d1)) ?? ''
    : user.orgId;
  if (!orgId) {
    return jsonPrivate({ error: 'FORBIDDEN' }, 403);
  }
  const hasAccess = await deps.verifyWorkspaceAccess(user.id, orgId, d1);
  if (!hasAccess) {
    return jsonPrivate({ error: 'FORBIDDEN' }, 403);
  }
  const isAdmin = await deps.verifyWorkspaceAdminRole(user.id, orgId, d1);

  const url = new URL(req.url);
  const requestId = url.searchParams.get('requestId')?.trim();

  if (requestId) {
    const record = await getPublishGateById(d1, orgId, requestId);
    if (!record) {
      return jsonPrivate({ error: 'NOT_FOUND' }, 404);
    }
    const events = await listPublishGateAuditEvents(d1, orgId, requestId);
    return jsonPrivate(
      { record: sanitizeRecordForCaller(record, isAdmin), events, publicationMode: 'MOCK_ONLY' },
      200,
    );
  }

  const records = await listPublishGatesForOrg(d1, orgId, 20);
  return jsonPrivate(
    {
      records: records.map((r) => sanitizeRecordForCaller(r, isAdmin)),
      publicationMode: 'MOCK_ONLY',
    },
    200,
  );
}

export async function handlePublishGatePost(
  req: Request,
  deps: PublishGateHttpDeps,
): Promise<Response> {
  if (!deps.isFeatureEnabled()) {
    return jsonPrivate({ error: 'FEATURE_DISABLED' }, 404);
  }
  const user = await deps.getCurrentUser();
  if (!user) {
    return jsonPrivate({ error: 'UNAUTHORIZED' }, 401);
  }
  const csrfOk = await deps.verifyCsrf(req);
  if (!csrfOk) {
    return jsonPrivate({ error: 'CSRF_VALIDATION_FAILED' }, 403);
  }
  const d1 = await deps.getD1();
  if (!d1) {
    return jsonPrivate({ error: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const orgId = deps.resolveUserOrgId
    ? (await deps.resolveUserOrgId(user.id, d1)) ?? ''
    : user.orgId;
  if (!orgId) {
    return jsonPrivate({ error: 'FORBIDDEN' }, 403);
  }
  const canWrite = deps.verifyWorkspaceWriteRole
    ? await deps.verifyWorkspaceWriteRole(user.id, orgId, d1)
    : await deps.verifyWorkspaceAccess(user.id, orgId, d1);
  if (!canWrite) {
    return jsonPrivate({ error: 'FORBIDDEN' }, 403);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonPrivate({ error: 'INVALID_JSON' }, 400);
  }

  const parsed = publishGatePostActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate(
      { error: 'VALIDATION_FAILED', details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const nowMs = (deps.nowMs ?? Date.now)();
  const nowIso = new Date(nowMs).toISOString();
  const action = parsed.data;
  const isAdmin = await deps.verifyWorkspaceAdminRole(user.id, orgId, d1);

  if (action.action === 'create') {
    const result = await createOrReplayPublishGateRequest(d1, {
      orgId,
      userId: user.id,
      payload: toCanonicalPayload(action.payload),
      nowIso,
    });
    if (result.status === 'idempotency_conflict') {
      return jsonPrivate(
        { error: 'IDEMPOTENCY_PAYLOAD_CONFLICT', existingRequestId: result.existingRequestId },
        409,
      );
    }
    return jsonPrivate(
      {
        record: sanitizeRecordForCaller(result.record, isAdmin),
        replayed: result.status === 'replayed',
      },
      result.status === 'created' ? 201 : 200,
    );
  }

  if (action.action === 'preflight') {
    const existing = await getPublishGateById(d1, orgId, action.requestId);
    if (!existing) {
      return jsonPrivate({ error: 'NOT_FOUND' }, 404);
    }
    if (
      existing.state !== 'DRAFT' &&
      existing.state !== 'PREFLIGHT_REQUIRED' &&
      existing.state !== 'PREFLIGHT_BLOCKED'
    ) {
      return jsonPrivate({ error: 'INVALID_STATE_FOR_PREFLIGHT', state: existing.state }, 409);
    }
    const adapter = getMockPublishGateAdapter(existing.platform);
    const evaluation = adapter.preflight({
      payload: existing.payload,
      failureInjection: action.failureInjection,
    });
    const updated = await recordPreflightOutcomeAtomic(d1, {
      orgId,
      requestId: existing.requestId,
      actorUserId: user.id,
      expectedVersion: existing.version,
      expectedState: existing.state,
      passed: evaluation.passed,
      snapshot: evaluation.snapshot,
      payloadDigestSha256: existing.payloadDigestSha256,
      nowIso,
    });
    if (!updated) {
      return jsonPrivate({ error: 'CONCURRENT_STATE_CONFLICT' }, 409);
    }
    return jsonPrivate(
      { record: sanitizeRecordForCaller(updated, isAdmin), preflight: evaluation },
      200,
    );
  }

  if (action.action === 'submit_for_approval') {
    const existing = await getPublishGateById(d1, orgId, action.requestId);
    if (!existing) {
      return jsonPrivate({ error: 'NOT_FOUND' }, 404);
    }
    if (existing.state !== 'READY_FOR_REVIEW') {
      return jsonPrivate({ error: 'PREFLIGHT_REQUIRED_BEFORE_APPROVAL', state: existing.state }, 409);
    }
    const expiresAtIso = new Date(nowMs + APPROVAL_WINDOW_MS).toISOString();
    const updated = await submitForHumanApprovalAtomic(d1, {
      orgId,
      requestId: existing.requestId,
      actorUserId: user.id,
      expectedVersion: existing.version,
      payloadDigestSha256: existing.payloadDigestSha256,
      expiresAtIso,
      nowIso,
    });
    if (!updated) {
      return jsonPrivate({ error: 'CONCURRENT_STATE_CONFLICT' }, 409);
    }
    if (deps.emitGateRequested) {
      try {
        await deps.emitGateRequested({
          requestId: updated.requestId,
          orgId,
          campaignId: updated.campaignId,
          platform: updated.platform,
          payloadDigestSha256: updated.payloadDigestSha256,
          approvalVersion: updated.approvalVersion,
          publicationMode: 'MOCK_ONLY',
        });
      } catch {
        // Best-effort Inngest event; D1 ledger commit is authoritative.
      }
    }
    return jsonPrivate({ record: sanitizeRecordForCaller(updated, isAdmin) }, 200);
  }

  const actionCtx: ActionContext = {
    d1,
    orgId,
    userId: user.id,
    isAdmin,
    nowIso,
    emitHumanApproved: deps.emitHumanApproved,
  };

  if (action.action === 'approve' || action.action === 'reject') {
    return handleApprovalDecisionAction(actionCtx, action);
  }
  if (action.action === 'execute_mock') {
    return handleExecuteMockAction(actionCtx, action);
  }
  return handleMutateAndReconcileActions(actionCtx, action);
}
